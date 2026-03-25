import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { CustomLoggerService } from '../logger/custom-logger.service';
import { getRequestContext } from '../middleware/request-context.middleware';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly slowRequestThreshold =
    parseInt(process.env.SLOW_REQUEST_THRESHOLD_MS || '1000', 10);

  constructor(private readonly logger: CustomLoggerService) {
    this.logger.setContext('LoggingInterceptor');
  }

  intercept(executionCtx: ExecutionContext, next: CallHandler): Observable<any> {
    const request = executionCtx.switchToHttp().getRequest();
    const { method, url } = request;
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          const requestId = this.resolveRequestId(request);

          if (duration > this.slowRequestThreshold) {
            this.logger.warn({
              message: 'Slow request detected',
              requestId,
              method,
              url,
              duration,
              threshold: this.slowRequestThreshold,
            });
          } else {
            this.logger.log({
              message: 'Request completed',
              requestId,
              method,
              url,
              duration,
            });
          }
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          const requestId = this.resolveRequestId(request);

          this.logger.error({
            message: 'Request failed',
            requestId,
            method,
            url,
            duration,
            error: error.message,
            stack: error.stack,
          });
        },
      }),
    );
  }

  /**
   * Resolve requestId with a clear priority chain:
   *  1. AsyncLocalStorage context (set by RequestIdMiddleware / RequestContextMiddleware)
   *  2. x-request-id header on the request object (fallback)
   *  3. 'unknown' sentinel so logs are never missing the field
   */
  private resolveRequestId(request: any): string {
    return (
      getRequestContext()?.requestId ??
      (request.headers?.['x-request-id'] as string | undefined) ??
      'unknown'
    );
  }
}
