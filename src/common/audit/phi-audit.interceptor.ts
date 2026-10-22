import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditLogService } from '../services/audit-log.service';
import { AUDIT_LOG_METADATA_KEY, AuditLogMetadata } from './audit-log.decorator';
import { PhiAuditAction } from './dto/query-audit-logs.dto';

/**
 * PhiAuditInterceptor – writes a tamper-evident sensitive audit entry for every
 * route decorated with @AuditLog. Falls back gracefully when no metadata is set.
 *
 * Attach globally or per-controller via @UseInterceptors(PhiAuditInterceptor).
 */
@Injectable()
export class PhiAuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditLogService: AuditLogService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const metadata = this.reflector.get<AuditLogMetadata | undefined>(
      AUDIT_LOG_METADATA_KEY,
      context.getHandler(),
    );

    // No @AuditLog decorator on this handler — skip PHI logging
    if (!metadata) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const { method, url, user, ip, headers } = request;

    const actorAddress: string = user?.id ?? '00000000-0000-0000-0000-000000000000';
    const ipAddress: string =
      (headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
      ip ??
      request.connection?.remoteAddress ??
      '';
    const resourceId: string | undefined = this.extractResourceId(url);

    return next.handle().pipe(
      tap(async () => {
        try {
          await this.auditLogService.log({
            actorAddress,
            action: this.mapMethodToAction(method),
            resourceType: metadata.entityType,
            resourceId,
            ipAddress,
            metadata: {
              operation: metadata.operation,
              url,
              method,
            },
          });
        } catch {
          // Never crash the request because of an audit failure
        }
      }),
    );
  }

  /** Maps an HTTP method to a PhiAuditAction string. */
  private mapMethodToAction(httpMethod: string): string {
    switch (httpMethod.toUpperCase()) {
      case 'GET':
        return PhiAuditAction.READ;
      case 'DELETE':
        return PhiAuditAction.DELETE;
      case 'POST':
      case 'PUT':
      case 'PATCH':
        return PhiAuditAction.WRITE;
      default:
        return PhiAuditAction.READ;
    }
  }

  /** Extracts the first UUID-like segment from the URL path. */
  private extractResourceId(url: string): string | undefined {
    const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
    const match = url.match(uuidRegex);
    return match ? match[0] : undefined;
  }
}
