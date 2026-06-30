import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditLogService } from '../services/audit-log.service';
import { SensitiveAuditAction } from '../entities/sensitive-audit-log.entity';

/**
 * PhiAuditInterceptor — records every PHI access to the append-only `audit_log`
 * table (INSERT-only, enforced at the DB level).
 *
 * Attach with @UseInterceptors(PhiAuditInterceptor) on any controller or route
 * that reads or writes Protected Health Information.
 */
@Injectable()
export class PhiAuditInterceptor implements NestInterceptor {
  constructor(private readonly auditLogService: AuditLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, user, ip, headers, params, query, body } = request;

    const actorAddress: string = user?.id ?? 'anonymous';
    const actorRole: string | null = user?.role ?? null;
    const tenantId: string | null = user?.tenantId ?? null;
    const ipAddress: string = ip ?? request.connection?.remoteAddress ?? '';
    const patientId: string | null = this.extractPatientId(params, query, body, url);

    return next.handle().pipe(
      tap(async () => {
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
