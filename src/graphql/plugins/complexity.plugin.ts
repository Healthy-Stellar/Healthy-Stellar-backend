import { Logger } from '@nestjs/common';
import { Plugin } from '@nestjs/apollo';
import {
  ApolloServerPlugin,
  GraphQLRequestContext,
  GraphQLRequestListener,
} from '@apollo/server';
import { GraphQLSchemaHost } from '@nestjs/graphql';
import { ConfigService } from '@nestjs/config';
import {
  DocumentNode,
  FragmentDefinitionNode,
  GraphQLError,
  Kind,
  OperationDefinitionNode,
  SelectionSetNode,
} from 'graphql';
import {
  fieldExtensionsEstimator,
  getComplexity,
  simpleEstimator,
} from 'graphql-query-complexity';
import { AuditLogService } from '../../common/services/audit-log.service';
import { TenantConfigService } from '../../tenant-config/services/tenant-config.service';

/**
 * Default complexity budget applied when neither the
 * `GRAPHQL_QUERY_COMPLEXITY_THRESHOLD` environment variable nor a
 * per-tenant override (see TENANT_CONFIG_KEY_MAX_COMPLEXITY below) is set.
 * Mirrors the documented default in .env.example.
 */
export const DEFAULT_COMPLEXITY_THRESHOLD = 150;

/**
 * @deprecated Retained for backward compatibility with existing tests/consumers
 * that import the original hard-coded threshold. New code should read the
 * effective, configurable threshold resolved by ComplexityPlugin instead.
 */
export const COMPLEXITY_THRESHOLD = 50;

/**
 * Default maximum query depth applied when neither the
 * `GRAPHQL_MAX_QUERY_DEPTH` environment variable nor a per-tenant override
 * (see TENANT_CONFIG_KEY_MAX_DEPTH below) is set. Mirrors the documented
 * default in .env.example, and the `depthLimit()` validation rule wired up
 * in graphql.module.ts.
 */
export const DEFAULT_MAX_QUERY_DEPTH = 7;

/**
 * Tenant-config keys used to look up per-tenant overrides via
 * TenantConfigService. These follow the same tenantId -> key resolution
 * pattern (tenant override -> global default -> env var) documented in
 * src/tenant-config/services/tenant-config.service.ts. Tenant overrides can
 * only *tighten* the environment-wide ceiling, never loosen it, so a
 * misconfigured/compromised tenant cannot disable this DoS protection.
 */
export const TENANT_CONFIG_KEY_MAX_COMPLEXITY = 'graphql_max_query_complexity';
export const TENANT_CONFIG_KEY_MAX_DEPTH = 'graphql_max_query_depth';

export interface RequestingClient {
  userId: string;
  tenantId: string;
  clientIp: string;
}

/**
 * Computes the maximum selection-set nesting depth of a GraphQL operation.
 * This is used, in addition to the static `depthLimit()` validation rule
 * configured in graphql.module.ts, to support per-tenant depth overrides
 * that cannot be expressed by a validation rule built once at server
 * start-up. Introspection fields (`__typename`, `__schema`, ...) are
 * excluded, and fragment spreads are resolved (with cycle protection).
 */
export function calculateQueryDepth(
  document: DocumentNode,
  operationName?: string | null,
): number {
  const fragments = new Map<string, FragmentDefinitionNode>();
  for (const definition of document.definitions) {
    if (definition.kind === Kind.FRAGMENT_DEFINITION) {
      fragments.set(definition.name.value, definition);
    }
  }

  const operation = document.definitions.find(
    (definition): definition is OperationDefinitionNode =>
      definition.kind === Kind.OPERATION_DEFINITION &&
      (operationName ? definition.name?.value === operationName : true),
  );

  if (!operation) {
    return 0;
  }

  const visitedFragments = new Set<string>();

  const walk = (selectionSet: SelectionSetNode | undefined, depth: number): number => {
    if (!selectionSet) {
      return depth;
    }

    let maxDepth = depth;

    for (const selection of selectionSet.selections) {
      if (selection.kind === Kind.FIELD) {
        if (selection.name.value.startsWith('__')) {
          continue; // ignore introspection fields
        }
        const childDepth = selection.selectionSet
          ? walk(selection.selectionSet, depth + 1)
          : depth + 1;
        maxDepth = Math.max(maxDepth, childDepth);
      } else if (selection.kind === Kind.INLINE_FRAGMENT) {
        maxDepth = Math.max(maxDepth, walk(selection.selectionSet, depth));
      } else if (selection.kind === Kind.FRAGMENT_SPREAD) {
        const fragmentName = selection.name.value;
        if (visitedFragments.has(fragmentName)) {
          continue; // avoid infinite recursion on (invalid) cyclic fragments
        }
        const fragment = fragments.get(fragmentName);
        if (fragment) {
          visitedFragments.add(fragmentName);
          maxDepth = Math.max(maxDepth, walk(fragment.selectionSet, depth));
          visitedFragments.delete(fragmentName);
        }
      }
    }

    return maxDepth;
  };

  return walk(operation.selectionSet, 0);
}

/**
 * Enforces GraphQL query complexity and depth limits to protect against
 * resource-exhaustion (DoS) abuse.
 *
 * Layered defense:
 *  1. A static, environment-configured `depthLimit()` validation rule
 *     (wired up in graphql.module.ts) rejects over-deep documents during
 *     the GraphQL *validation* phase, before this plugin even runs.
 *  2. This plugin re-checks depth (allowing per-tenant tightening) and
 *     enforces a per-field complexity budget during `didResolveOperation`,
 *     which — like validation — runs strictly before execution, so
 *     resolvers are never invoked for a rejected query.
 *
 * Both rejection paths throw a `GraphQLError` (never a bare `Error`), so
 * Apollo returns a well-formed GraphQL error response (HTTP 200 with an
 * `errors` array carrying a machine-readable `extensions.code`) instead of
 * an HTTP 500.
 */
@Plugin()
export class ComplexityPlugin implements ApolloServerPlugin {
  private readonly logger = new Logger(ComplexityPlugin.name);

  constructor(
    private readonly gqlSchemaHost: GraphQLSchemaHost,
    private readonly configService: ConfigService,
    private readonly tenantConfigService: TenantConfigService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async requestDidStart(): Promise<GraphQLRequestListener<any>> {
    const { schema } = this.gqlSchemaHost;
    const plugin = this;

    return {
      async didResolveOperation(requestContext: GraphQLRequestContext<any>) {
        const { request, document, contextValue } = requestContext as unknown as {
          request: GraphQLRequestContext<any>['request'];
          document: DocumentNode;
          contextValue: any;
        };

        if (!document) {
          return;
        }

        const client = plugin.extractClientInfo(contextValue);
        const { complexityThreshold, maxDepth } = await plugin.resolveLimits(client.tenantId);

        // 1. Depth check (per-tenant aware; the environment-wide ceiling is
        // already enforced separately via the depthLimit() validation rule).
        const depth = calculateQueryDepth(document, request.operationName);
        if (depth > maxDepth) {
          await plugin.rejectQuery({
            reason: 'QUERY_DEPTH_EXCEEDED',
            message:
              `Query depth ${depth} exceeds maximum allowed depth of ${maxDepth}. ` +
              `Reduce nested selection depth or split the query into multiple operations.`,
            extensions: {
              code: 'GRAPHQL_QUERY_DEPTH_EXCEEDED',
              depth,
              maxDepth,
            },
            client,
            operationName: request.operationName,
          });
        }

        // 2. Per-field complexity check.
        const complexity = getComplexity({
          schema,
          operationName: request.operationName,
          query: document,
          variables: request.variables,
          estimators: [
            // Honors per-field `complexity` set via GraphQL field extensions.
            fieldExtensionsEstimator(),
            // Falls back to a flat cost of 1 per requested field.
            simpleEstimator({ defaultComplexity: 1 }),
          ],
        });

        if (complexity > complexityThreshold) {
          await plugin.rejectQuery({
            reason: 'QUERY_COMPLEXITY_EXCEEDED',
            message:
              `Query complexity ${complexity} exceeds maximum allowed complexity of ${complexityThreshold}. ` +
              `Consider using filters, pagination, or reducing nested selections.`,
            extensions: {
              code: 'GRAPHQL_QUERY_COMPLEXITY_EXCEEDED',
              complexity,
              threshold: complexityThreshold,
            },
            client,
            operationName: request.operationName,
          });
        }
      },
    };
  }

  /**
   * Resolves the effective complexity/depth limits for a request. Tenant
   * overrides (looked up via TenantConfigService, which already implements
   * the tenant -> global-default -> env-var fallback chain used across the
   * codebase) may only tighten the environment-wide ceiling, never exceed
   * it — this keeps a compromised/misconfigured tenant from disabling the
   * DoS protection.
   */
  private async resolveLimits(
    tenantId: string,
  ): Promise<{ complexityThreshold: number; maxDepth: number }> {
    const envComplexity = this.readEnvNumber(
      'GRAPHQL_QUERY_COMPLEXITY_THRESHOLD',
      DEFAULT_COMPLEXITY_THRESHOLD,
    );
    const envMaxDepth = this.readEnvNumber('GRAPHQL_MAX_QUERY_DEPTH', DEFAULT_MAX_QUERY_DEPTH);

    let complexityThreshold = envComplexity;
    let maxDepth = envMaxDepth;

    if (tenantId && tenantId !== 'global') {
      try {
        const [tenantComplexity, tenantDepth] = await Promise.all([
          this.tenantConfigService.get<number>(tenantId, TENANT_CONFIG_KEY_MAX_COMPLEXITY),
          this.tenantConfigService.get<number>(tenantId, TENANT_CONFIG_KEY_MAX_DEPTH),
        ]);

        if (this.isPositiveNumber(tenantComplexity)) {
          complexityThreshold = Math.min(tenantComplexity, envComplexity);
        }
        if (this.isPositiveNumber(tenantDepth)) {
          maxDepth = Math.min(tenantDepth, envMaxDepth);
        }
      } catch (error) {
        // Never let a tenant-config/Redis/DB blip turn into a broken
        // request — fall back to the environment-wide defaults and log.
        this.logger.warn(
          `Failed to resolve tenant GraphQL limits for tenant=${tenantId}; ` +
            `falling back to environment defaults. ${
              error instanceof Error ? error.message : String(error)
            }`,
        );
      }
    }

    return { complexityThreshold, maxDepth };
  }

  private isPositiveNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0;
  }

  private readEnvNumber(key: string, fallback: number): number {
    const raw = this.configService.get<string>(key) ?? process.env[key];
    const parsed = Number(raw);
    return raw !== undefined && !Number.isNaN(parsed) ? parsed : fallback;
  }

  /** Extracts the requesting client's identity for logging/audit purposes. */
  private extractClientInfo(contextValue: any): RequestingClient {
    const req = contextValue?.req ?? {};
    const user = req.user ?? {};
    const headers = req.headers ?? {};

    const tenantId = user.tenantId ?? user.organizationId ?? headers['x-tenant-id'] ?? 'global';
    const userId = user.userId ?? user.id ?? 'anonymous';
    const forwardedFor: string | undefined = headers['x-forwarded-for'];
    const clientIp =
      (forwardedFor ? forwardedFor.split(',')[0].trim() : undefined) ??
      req.ip ??
      req.socket?.remoteAddress ??
      'unknown';

    return { userId: String(userId), tenantId: String(tenantId), clientIp: String(clientIp) };
  }

  /**
   * Logs and audits a rejected query, then throws a GraphQLError carrying
   * a machine-readable `extensions.code`. Because this runs from within
   * `didResolveOperation` — a pre-execution lifecycle hook — the thrown
   * error short-circuits the request before any resolver is invoked, and
   * Apollo surfaces it as a normal GraphQL error response rather than an
   * HTTP 500.
   */
  private async rejectQuery(params: {
    reason: string;
    message: string;
    extensions: Record<string, any>;
    client: RequestingClient;
    operationName?: string | null;
  }): Promise<never> {
    const { reason, message, extensions, client, operationName } = params;
    const operation = operationName ?? 'anonymous';

    this.logger.warn(
      `GraphQL query rejected [${reason}] tenant=${client.tenantId} user=${client.userId} ` +
        `operation=${operation} ip=${client.clientIp} :: ${message}`,
    );

    try {
      await this.auditLogService.log({
        entityType: 'GraphQLQuery',
        entityId: operation,
        action: 'QUERY_REJECTED',
        userId: client.userId,
        changes: { reason, ...extensions },
        metadata: {
          tenantId: client.tenantId,
          clientIp: client.clientIp,
          operationName: operation,
        },
      } as any);
    } catch (auditError) {
      // Audit-log failures must never mask the rejection or crash the request.
      this.logger.error(
        `Failed to record audit log entry for rejected GraphQL query: ${
          auditError instanceof Error ? auditError.message : String(auditError)
        }`,
      );
    }

    throw new GraphQLError(message, { extensions });
  }
}
