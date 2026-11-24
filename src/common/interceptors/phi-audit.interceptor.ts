import {
  Injectable,
  Logger,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { InjectMetric, makeCounterProvider } from '@willsoto/nestjs-prometheus';
import { Counter } from 'prom-client';
import { AuditLogService } from '../services/audit-log.service';
import { SensitiveAuditAction } from '../entities/sensitive-audit-log.entity';

/** Placeholder actor recorded when no authenticated principal can be resolved. */
export const ANONYMOUS_ACTOR = 'anonymous';

/** Metric that alerts when an authenticated PHI access cannot be attributed. */
export const PHI_AUDIT_ANONYMOUS_ROWS_METRIC = 'medchain_phi_audit_anonymous_rows_total';

/**
 * Counter incremented whenever an *authenticated* request produces a PHI audit
 * row that cannot be attributed to an actor or a tenant. A non-zero rate means
 * the audit trail can no longer answer "who accessed this patient's record".
 */
export const PhiAuditAnonymousRowsCounter = makeCounterProvider({
  name: PHI_AUDIT_ANONYMOUS_ROWS_METRIC,
  help: 'PHI audit rows written for an authenticated request without an attributable actor or tenant',
  labelNames: ['reason'],
});

/**
 * PhiAuditInterceptor — records every PHI access to the append-only `audit_log`
 * table (INSERT-only, enforced at the DB level).
 *
 * Attach with @UseInterceptors(PhiAuditInterceptor) on any controller or route
 * that reads or writes Protected Health Information.
 */
@Injectable()
export class PhiAuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(PhiAuditInterceptor.name);

  constructor(
    private readonly auditLogService: AuditLogService,
    @InjectMetric(PHI_AUDIT_ANONYMOUS_ROWS_METRIC)
    private readonly anonymousRowsCounter: Counter<string>,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, user, ip, headers, params, query, body } = request;

    // The JWT principal (see JwtAuthGuard) carries `userId` and `organizationId`.
    const actorAddress: string = user?.userId ?? user?.id ?? ANONYMOUS_ACTOR;
    const actorRole: string | null = user?.role ?? null;
    const tenantId: string | null = user?.organizationId ?? user?.tenantId ?? null;
    const ipAddress: string = ip ?? request.connection?.remoteAddress ?? '';
    const patientId: string | null = this.extractPatientId(params, query, body, url);

    return next.handle().pipe(
      tap(async () => {
        // HIPAA: every PHI access must name the actor and the tenant. Writing a
        // row for an authenticated principal that resolved to an anonymous
        // actor (or a null tenant) is a compliance defect — surface it on an
        // alertable metric and in the logs rather than silently.
        if (user) {
          if (actorAddress === ANONYMOUS_ACTOR) {
            this.reportUnattributedAccess('missing_actor', method, url);
          }
          if (!tenantId) {
            this.reportUnattributedAccess('missing_tenant', method, url);
          }
        }

        try {
          await this.auditLogService.log({
            actorAddress,
            action: this.resolveAction(method),
            resourceId: this.extractResourceId(url),
            resourceType: this.resolveResourceType(url),
            ipAddress,
            actorRole,
            tenantId,
            patientId,
            metadata: { userAgent: headers['user-agent'] ?? '', url },
          });
        } catch {
          // Never let an audit failure crash the request
        }
      }),
    );
  }

  /** Emits the alerting metric and an error log for an unattributable row. */
  private reportUnattributedAccess(
    reason: 'missing_actor' | 'missing_tenant',
    method: string,
    url: string,
  ): void {
    this.anonymousRowsCounter.inc({ reason });
    this.logger.error(
      `PHI audit row is not attributable (${reason}) for an authenticated request: ${method} ${url}`,
    );
  }

  private resolveAction(httpMethod: string): SensitiveAuditAction {
    switch (httpMethod.toUpperCase()) {
      case 'GET':
        return SensitiveAuditAction.PHI_READ;
      case 'DELETE':
        return SensitiveAuditAction.PHI_DELETE;
      default:
        return SensitiveAuditAction.PHI_WRITE;
    }
  }

  private resolveResourceType(url: string): string {
    if (url.includes('medical-records')) return 'MedicalRecord';
    if (url.includes('clinical-notes')) return 'ClinicalNote';
    if (url.includes('patients')) return 'Patient';
    if (url.includes('ehr')) return 'EHR';
    return 'PHI';
  }

  private extractResourceId(url: string): string | undefined {
    const match = url.match(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
    );
    return match ? match[0] : undefined;
  }

  private extractPatientId(
    params: Record<string, string> | undefined,
    query: Record<string, string> | undefined,
    body: Record<string, any> | undefined,
    url: string,
  ): string | null {
    if (params?.patientId) return params.patientId;
    if (query?.patientId) return query.patientId;
    if (body?.patientId) return body.patientId;

    // For /patients/:uuid routes the path UUID is the patient
    const m = url.match(
      /\/patients\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
    );
    if (m) return m[1];

    return null;
  }
}
