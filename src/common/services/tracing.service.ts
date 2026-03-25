import { Injectable } from '@nestjs/common';
import { trace, context, Span, SpanStatusCode, SpanKind } from '@opentelemetry/api';

@Injectable()
export class TracingService {
  private readonly tracer = trace.getTracer('healthy-stellar-backend');

  /**
   * Create and execute a custom span
   */
  async withSpan<T>(
    name: string,
    fn: (span: Span) => Promise<T>,
    attributes?: Record<string, any>,
    kind: SpanKind = SpanKind.INTERNAL,
  ): Promise<T> {
    const span = this.tracer.startSpan(name, { kind, attributes });

    return context.with(trace.setSpan(context.active(), span), async () => {
      try {
        const result = await fn(span);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : String(error),
        });
        span.recordException(error as Error);
        throw error;
      } finally {
        span.end();
      }
    });
  }

  /**
   * Create and execute a synchronous span
   */
  withSpanSync<T>(
    name: string,
    fn: (span: Span) => T,
    attributes?: Record<string, any>,
    kind: SpanKind = SpanKind.INTERNAL,
  ): T {
    const span = this.tracer.startSpan(name, { kind, attributes });

    return context.with(trace.setSpan(context.active(), span), () => {
      try {
        const result = fn(span);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : String(error),
        });
        span.recordException(error as Error);
        throw error;
      } finally {
        span.end();
      }
    });
  }

  /**
   * Get current trace ID for logging
   */
  getCurrentTraceId(): string | undefined {
    const span = trace.getSpan(context.active());
    return span?.spanContext().traceId;
  }

  /**
   * Get current span ID
   */
  getCurrentSpanId(): string | undefined {
    const span = trace.getSpan(context.active());
    return span?.spanContext().spanId;
  }

  /**
   * Get current trace context as object
   */
  getCurrentTraceContext(): { traceId?: string; spanId?: string; traceFlags?: number } {
    const span = trace.getSpan(context.active());
    if (!span) {
      return {};
    }
    const spanContext = span.spanContext();
    return {
      traceId: spanContext.traceId,
      spanId: spanContext.spanId,
      traceFlags: spanContext.traceFlags,
    };
  }

  /**
   * Add attributes to current span
   */
  addAttributes(attributes: Record<string, any>): void {
    const span = trace.getSpan(context.active());
    if (span) {
      Object.entries(attributes).forEach(([key, value]) => {
        span.setAttribute(key, value);
      });
    }
  }

  /**
   * Add event to current span
   */
  addEvent(name: string, attributes?: Record<string, any>): void {
    const span = trace.getSpan(context.active());
    if (span) {
      span.addEvent(name, attributes);
    }
  }

  /**
   * Record exception in current span
   */
  recordException(error: Error): void {
    const span = trace.getSpan(context.active());
    if (span) {
      span.recordException(error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
    }
  }

  /**
   * Set status on current span
   */
  setStatus(code: SpanStatusCode, message?: string): void {
    const span = trace.getSpan(context.active());
    if (span) {
      span.setStatus({ code, message });
    }
  }

  /**
   * Create a child span context for async operations
   */
  getTraceContext(): Record<string, string> {
    const traceContext = this.getCurrentTraceContext();
    return {
      'traceparent': this.buildTraceParent(traceContext),
    };
  }

  /**
   * Build W3C Trace Context traceparent header
   */
  private buildTraceParent(traceContext: { traceId?: string; spanId?: string; traceFlags?: number }): string {
    const version = '00';
    const traceId = traceContext.traceId || '0'.repeat(32);
    const spanId = traceContext.spanId || '0'.repeat(16);
    const traceFlags = (traceContext.traceFlags ?? 1).toString(16).padStart(2, '0');
    return `${version}-${traceId}-${spanId}-${traceFlags}`;
  }
}
