import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { CustomLoggerService } from '../logger/custom-logger.service';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly slowRequestThreshold = 
    parseInt(process.env.SLOW_REQUEST_THRESHOLD_MS || '1000', 10);

  constructor(private readonly logger: CustomLoggerService) {
    this.logger.setContext('LoggingInterceptor');
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url } = request;
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          
          if (duration > this.slowRequestThreshold) {
            this.logger.warn({
              message: 'Slow request detected',
              method,
              url,
              duration,
              threshold: this.slowRequestThreshold,
            });
          }
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          this.logger.error({
            message: 'Request failed',
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
}
