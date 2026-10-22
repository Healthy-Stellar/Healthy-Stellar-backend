import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  RequestTimeoutException,
} from '@nestjs/common';
import { Observable, throwError, TimeoutError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';
import { ConfigService } from '@nestjs/config';
import { Logger } from '../logger/logger.service';

/**
 * Query Performance Interceptor
 * 
 * Prevents high-latency queries from degrading core flows under peak load.
 * - Enforces request timeout limits
 * - Logs slow queries for analysis
 * - Provides metrics for monitoring
 */
@Injectable()
export class QueryPerformanceInterceptor implements NestInterceptor {
  private readonly requestTimeout: number;
  private readonly slowQueryThreshold: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: Logger,
  ) {
    this.requestTimeout = this.configService.get<number>('REQUEST_TIMEOUT_MS', 30000);
    this.slowQueryThreshold = this.configService.get<number>('SLOW_QUERY_THRESHOLD_MS', 1000);
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const startTime = Date.now();
    const path = request.url;
    const method = request.method;

    return next.handle().pipe(
      timeout(this.requestTimeout),
      catchError((error) => {
        const duration = Date.now() - startTime;

        if (error instanceof TimeoutError) {
          this.logger.error('Request timeout exceeded', {
            path,
            method,
            duration,
            timeout: this.requestTimeout,
            context: 'QueryPerformanceInterceptor',
          });

          return throwError(
            () =>
              new RequestTimeoutException(
                `Request exceeded timeout of ${this.requestTimeout}ms`,
              ),
          );
        }

        // Log slow queries even on error
        if (duration > this.slowQueryThreshold) {
          this.logger.warn('Slow query detected on error path', {
            path,
            method,
            duration,
            threshold: this.slowQueryThreshold,
            error: error.message,
            context: 'QueryPerformanceInterceptor',
          });
        }

        return throwError(() => error);
      }),
    );
  }
}
