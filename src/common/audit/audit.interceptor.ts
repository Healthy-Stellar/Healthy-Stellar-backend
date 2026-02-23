import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from './audit.service';
import { AuditEventAction } from './dto/audit-event.dto';

/**
 * AuditInterceptor – automatically logs every RecordsController request/response.
 * Attach with @UseInterceptors(AuditInterceptor) on the controller or individual routes.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, user, ip, headers } = request;
    const actorId: string = user?.id ?? '00000000-0000-0000-0000-000000000000';
    const ipAddress: string = ip ?? request.connection?.remoteAddress ?? '';
    const userAgent: string = headers['user-agent'] ?? '';

    return next.handle().pipe(
      tap(async () => {
        try {
          await this.auditService.log({
            actorId,
            action: this.resolveAction(method),
            resourceId: this.extractResourceId(url),
            resourceType: 'MedicalRecord',
            ipAddress,
            userAgent,
          });
        } catch {
          // Never crash the request because of an audit failure
        }
      }),
    );
  }

  private resolveAction(httpMethod: string): AuditEventAction {
    switch (httpMethod.toUpperCase()) {
      case 'GET':
        return AuditEventAction.RECORD_READ;
      case 'POST':
      case 'PUT':
      case 'PATCH':
      case 'DELETE':
        return AuditEventAction.RECORD_WRITE;
      default:
        return AuditEventAction.RECORD_READ;
    }
  }

  private extractResourceId(url: string): string | undefined {
    const uuidRegex =
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
    const match = url.match(uuidRegex);
    return match ? match[0] : undefined;
  }
}
