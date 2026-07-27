import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { trace, SpanStatusCode, SpanKind, context as otelContext } from '@opentelemetry/api';
import { throwError } from 'rxjs';

const tracer = trace.getTracer('healthy-stellar-http');

/**
 * Creates a named OTel span for every HTTP request and propagates the
 * trace-id via the X-Trace-ID response header.
 *
 * Span attributes follow OpenTelemetry HTTP semantic conventions:
 * https://opentelemetry.io/docs/specs/semconv/http/http-spans/
 */
@Injectable()
export class TracingInterceptor implements NestInterceptor {
  intercept(executionCtx: ExecutionContext, next: CallHandler): Observable<any> {
    const request  = executionCtx.switchToHttp().getRequest();
    const response = executionCtx.switchToHttp().getResponse();
    const { method, url, path } = request;

    const span = tracer.startSpan(`HTTP ${method} ${path ?? url}`, {
      kind: SpanKind.SERVER,
      attributes: {
        'http.method':     method,
        'http.url':        url,
        'http.route':      path ?? url,
        'http.user_agent': request.headers['user-agent'] ?? '',
        'net.peer.ip':     request.ip ?? '',
      },
    });

    const traceId = span.spanContext().traceId;
    request.traceId = traceId;
    response.setHeader('X-Trace-ID', traceId);

    return otelContext.with(trace.setSpan(otelContext.active(), span), () =>
      next.handle().pipe(
        tap(() => {
          span.setAttribute('http.status_code', response.statusCode);
          span.setStatus({ code: SpanStatusCode.OK });
          span.end();
        }),
        catchError((err) => {
          span.setAttribute('http.status_code', err.status ?? 500);
          span.recordException(err);
          span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
          span.end();
          return throwError(() => err);
        }),
      ),
    );
  }
}
