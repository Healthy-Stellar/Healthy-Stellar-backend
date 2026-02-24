import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { AuditLogService } from '../services/audit-log.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditLogService: AuditLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, body, user, ip, headers } = request;
    const userAgent = headers['user-agent'] || 'unknown';
    const startTime = Date.now();
    const requestId = headers['x-request-id'] || this.generateRequestId();

    request.auditContext = {
      userId: user?.id || 'anonymous',
      ipAddress: ip || request.connection?.remoteAddress,
      userAgent,
      requestId,
    };

    return next.handle().pipe(
      tap(async (response) => {
        const executionTime = Date.now() - startTime;

        if (this.shouldAudit(method, url)) {
          try {
            await this.auditLogService.create({
              operation: `${method}_${url.split('?')[0]}`,
              entityType: this.extractEntityType(url),
              entityId: this.extractEntityId(url, response),
              userId: request.auditContext.userId,
              ipAddress: request.auditContext.ipAddress,
              userAgent: request.auditContext.userAgent,
              newValues: this.sanitizeData(method === 'POST' ? body : response),
              status: 'success',
              executionTimeMs: executionTime,
              requestId: request.auditContext.requestId,
              sessionId: request.session?.id,
            });
          } catch (error) {
            console.error('[AUDIT] Failed to log request:', error);
          }
        }
      }),
      catchError(async (error) => {
        const executionTime = Date.now() - startTime;

        try {
          await this.auditLogService.create({
            operation: `${method}_${url.split('?')[0]}`,
            entityType: this.extractEntityType(url),
            userId: request.auditContext.userId,
            ipAddress: request.auditContext.ipAddress,
            userAgent: request.auditContext.userAgent,
            status: 'error',
            errorMessage: error.message || 'Unknown error',
            executionTimeMs: executionTime,
            requestId: request.auditContext.requestId,
            sessionId: request.session?.id,
          });
        } catch (auditError) {
          console.error('[AUDIT] Failed to log error:', auditError);
        }

        return throwError(() => error);
      }),
    );
  }

  private shouldAudit(method: string, url: string): boolean {
    const excludedPaths = ['/health', '/metrics', '/favicon.ico'];
    const excludedMethods = ['GET'];

    if (excludedPaths.some((path) => url.startsWith(path))) {
      return false;
    }

    if (process.env.AUDIT_GET_REQUESTS !== 'true' && excludedMethods.includes(method)) {
      return false;
    }

    return true;
  }

  private extractEntityType(url: string): string {
    const parts = url.split('/').filter(Boolean);
    return parts[0] || 'unknown';
  }

  private extractEntityId(url: string, response: any): string | undefined {
    const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
    const match = url.match(uuidRegex);

    if (match) {
      return match[0];
    }

    if (response?.id) {
      return response.id;
    }

    return undefined;
  }

  private sanitizeData(data: any): any {
    if (!data) return null;

    const sensitiveFields = [
      'password',
      'token',
      'secret',
      'apiKey',
      'creditCard',
      'ssn',
      'socialSecurityNumber',
    ];

    const sanitize = (obj: any): any => {
      if (typeof obj !== 'object' || obj === null) {
        return obj;
      }

      if (Array.isArray(obj)) {
        return obj.map(sanitize);
      }

      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (sensitiveFields.some((field) => key.toLowerCase().includes(field.toLowerCase()))) {
          sanitized[key] = '***REDACTED***';
        } else if (typeof value === 'object') {
          sanitized[key] = sanitize(value);
        } else {
          sanitized[key] = value;
        }
      }
      return sanitized;
    };

    return sanitize(data);
  }

  private generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
