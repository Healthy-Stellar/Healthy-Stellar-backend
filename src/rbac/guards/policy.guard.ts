import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  PolicyEngine,
  PolicyEvaluationContext,
  UserContext,
  ResourceContext,
  ActionContext,
} from './policy-engine.service';
import { JwtPayload } from '../../auth/services/auth-token.service';

export const POLICY_KEY = 'policy';
export const RESOURCE_KEY = 'resource';
export const ACTION_KEY = 'action';

export interface PolicyRequirement {
  name?: string;
  category?: string;
  resource?: string | ResourceContext;
  action?: string | ActionContext;
}

@Injectable()
export class PolicyGuard implements CanActivate {
  private readonly logger = new Logger(PolicyGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly policyEngine: PolicyEngine,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user: JwtPayload = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Get policy requirements from metadata
    const policyReq = this.reflector.getAllAndOverride<PolicyRequirement>(POLICY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!policyReq) {
      // No policy requirements, allow access
      return true;
    }

    // Build evaluation context
    const evaluationContext = this.buildEvaluationContext(user, request, policyReq, context);

    try {
      const result = await this.policyEngine.evaluate(evaluationContext, policyReq.category);

      if (!result.allowed) {
        this.logger.warn(`Policy evaluation failed for user ${user.sub}: ${result.reason}`);
        throw new ForbiddenException(result.reason || 'Access denied by policy');
      }

      // Store evaluation result in request for potential use in controllers
      request.policyEvaluation = result;

      return true;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }

      this.logger.error(`Policy evaluation error: ${error.message}`, error.stack);
      throw new ForbiddenException('Policy evaluation failed');
    }
  }

  private buildEvaluationContext(
    user: JwtPayload,
    request: any,
    policyReq: PolicyRequirement,
    executionContext: ExecutionContext,
  ): PolicyEvaluationContext {
    // Build user context
    const userContext: UserContext = {
      id: user.sub,
      roles: [user.role], // Basic role, can be extended
      permissions: user.permissions || [],
      attributes: {
        organizationId: user.organizationId,
        department: user.department,
        ...user.attributes,
      },
      organizationId: user.organizationId,
      department: user.department,
    };

    // Build resource context
    let resourceContext: ResourceContext | undefined;

    if (policyReq.resource) {
      if (typeof policyReq.resource === 'string') {
        resourceContext = {
          type: policyReq.resource,
          id: this.extractResourceId(request, executionContext),
          attributes: this.extractResourceAttributes(request),
        };
      } else {
        resourceContext = policyReq.resource;
      }
    }

    // Build action context
    let actionContext: ActionContext | undefined;

    if (policyReq.action) {
      if (typeof policyReq.action === 'string') {
        actionContext = {
          name: policyReq.action,
          attributes: {
            method: request.method,
            path: request.route?.path,
          },
        };
      } else {
        actionContext = policyReq.action;
      }
    }

    return {
      user: userContext,
      resource: resourceContext,
      action: actionContext,
      environment: {
        ip: request.ip,
        userAgent: request.get('User-Agent'),
        timestamp: new Date(),
      },
    };
  }

  private extractResourceId(request: any, context: ExecutionContext): string | undefined {
    // Try to extract resource ID from various sources
    const params = context.switchToHttp().getRequest().params;

    // Common parameter names for resource IDs
    const idParamNames = ['id', 'resourceId', 'patientId', 'recordId', 'userId'];

    for (const paramName of idParamNames) {
      if (params[paramName]) {
        return params[paramName];
      }
    }

    // Try body for resource ID
    if (request.body?.id) {
      return request.body.id;
    }

    return undefined;
  }

  private extractResourceAttributes(request: any): Record<string, any> {
    // Extract relevant attributes from request
    const attributes: Record<string, any> = {};

    if (request.body) {
      // Common attributes
      if (request.body.organizationId) attributes.organizationId = request.body.organizationId;
      if (request.body.ownerId) attributes.ownerId = request.body.ownerId;
      if (request.body.patientId) attributes.patientId = request.body.patientId;
      if (request.body.status) attributes.status = request.body.status;
    }

    if (request.params) {
      if (request.params.patientId) attributes.patientId = request.params.patientId;
      if (request.params.organizationId) attributes.organizationId = request.params.organizationId;
    }

    return attributes;
  }
}
