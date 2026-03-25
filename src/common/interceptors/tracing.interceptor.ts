import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { trace, context } from '@opentelemetry/api';

@Injectable()
export class TracingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // Get current span and extract trace ID
    const span = trace.getSpan(context.active());
    const traceId = span?.spanContext().traceId;

    // Add trace ID to request for logging
    if (traceId) {
      request.traceId = traceId;
      
      // Add trace ID to response headers
      response.setHeader('X-Trace-ID', traceId);
    }

    return next.handle().pipe(
      tap(() => {
        // Ensure trace ID is in response even after processing
        if (traceId && !response.headersSent) {
          response.setHeader('X-Trace-ID', traceId);
        }
      }),
    );
  }
}
