import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from '../services/audit.service';
import { AuditAction, ResourceType } from '../dto/audit-event.dto';

/**
 * Interceptor that automatically logs all requests to RecordsController
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    const { method, url, user, ip, headers } = request;
    const userAgent = headers['user-agent'] || 'Unknown';

    // Extract user ID from request (assumes auth guard sets request.user)
    const actorId = user?.id || user?.sub || 'anonymous';

    // Determine action based on HTTP method
    const action = this.mapMethodToAction(method);

    // Extract resource information
    const resourceInfo = this.extractResourceInfo(request);

    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: (data) => {
          const duration = Date.now() - startTime;

          // Log successful request
          void this.auditService.log({
            actorId,
            action,
            resourceId: resourceInfo.resourceId,
            resourceType: resourceInfo.resourceType,
            ipAddress: ip,
            userAgent,
            metadata: {
              method,
              url,
              statusCode: response.statusCode,
              duration,
              success: true,
              responseSize: JSON.stringify(data).length,
            },
          });

          this.logger.debug(
            `Audit logged: ${method} ${url} by ${actorId} - ${response.statusCode} (${duration}ms)`,
          );
        },
        error: (error) => {
          const duration = Date.now() - startTime;

          // Log failed request
          void this.auditService.log({
            actorId,
            action: AuditAction.ACCESS_DENIED,
            resourceId: resourceInfo.resourceId,
            resourceType: resourceInfo.resourceType,
            ipAddress: ip,
            userAgent,
            metadata: {
              method,
              url,
              statusCode: error.status || 500,
              duration,
              success: false,
              error: error.message,
            },
          });

          this.logger.warn(
            `Audit logged (error): ${method} ${url} by ${actorId} - ${error.status || 500} (${duration}ms)`,
          );
        },
      }),
    );
  }

  /**
   * Map HTTP method to audit action
   */
  private mapMethodToAction(method: string): AuditAction {
    switch (method.toUpperCase()) {
      case 'GET':
        return AuditAction.RECORD_READ;
      case 'POST':
        return AuditAction.RECORD_CREATE;
      case 'PUT':
      case 'PATCH':
        return AuditAction.RECORD_UPDATE;
      case 'DELETE':
        return AuditAction.RECORD_DELETE;
      default:
        return AuditAction.RECORD_READ;
    }
  }

  /**
   * Extract resource information from request
   */
  private extractResourceInfo(request: any): { resourceId: string; resourceType: ResourceType } {
    const { params, body, query, url } = request;

    // Try to extract resource ID from various sources
    let resourceId = params.id || params.recordId || body.recordId || query.id || 'unknown';
    let resourceType = ResourceType.RECORD;

    // Determine resource type from URL
    if (url.includes('/records')) {
      resourceType = ResourceType.RECORD;
    } else if (url.includes('/patients')) {
      resourceType = ResourceType.PATIENT;
      resourceId = params.patientId || resourceId;
    } else if (url.includes('/users')) {
      resourceType = ResourceType.USER;
      resourceId = params.userId || resourceId;
    } else if (url.includes('/access-grants')) {
      resourceType = ResourceType.ACCESS_GRANT;
      resourceId = params.grantId || resourceId;
    }

    return { resourceId, resourceType };
  }
}
