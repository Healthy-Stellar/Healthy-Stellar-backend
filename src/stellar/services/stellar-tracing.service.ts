import { Injectable, Logger } from '@nestjs/common';
import { trace, Span, SpanStatusCode, SpanKind } from '@opentelemetry/api';
import { ATTR_HTTP_URL, ATTR_HTTP_STATUS_CODE } from '@opentelemetry/semantic-conventions';

/**
 * StellarTracingService
 *
 * Utility service that wraps Horizon API and Soroban RPC calls with
 * OpenTelemetry spans. Provides detailed span attributes for diagnosing
 * latency issues in the blockchain module.
 *
 * Usage (in any stellar service):
 *   this.stellarTracing.traceHorizonCall('loadAccount', { address, operation }, async (span) => {
 *     // make the SDK call
 *     const result = await this.horizonServer.loadAccount(address);
 *     return result;
 *   });
 */
@Injectable()
export class StellarTracingService {
  private readonly logger = new Logger(StellarTracingService.name);
  private readonly tracer = trace.getTracer('stellar-horizon');

  /**
   * Wrap a Horizon API or Soroban RPC call with a traced span.
   *
   * @param operationName  Short name describing the RPC/Horizon call (e.g. 'loadAccount', 'sendTransaction')
   * @param attributes     Span attributes such as account address, operation type, etc.
   * @param fn             The actual SDK call wrapped by the span
   * @returns              The result of the SDK call
   */
  async traceHorizonCall<T>(
    operationName: string,
    attributes: Record<string, string | number | boolean | undefined>,
    fn: (span: Span) => Promise<T>,
  ): Promise<T> {
    const span = this.tracer.startSpan(
      `stellar.${operationName}`,
      {
        kind: SpanKind.CLIENT,
        attributes: {
          'stellar.operation': operationName,
          ...this.toAttributes(attributes),
        },
      },
    );

    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error: any) {
      const errorMessage = error?.message || String(error);

      // Record error event on the span
      span.addEvent('stellar.error', {
        'stellar.error.message': errorMessage,
        'stellar.error.type': error?.constructor?.name || 'Error',
      });

      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: errorMessage,
      });

      // Re-throw so callers can handle it normally
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Wrap a retry attempt with OpenTelemetry span events.
   * Call this from within the withRetry loop to annotate each attempt.
   */
  addRetryEvent(operationName: string, attempt: number, maxRetries: number, error?: string): void {
    const span = trace.getActiveSpan();
    if (!span) return;

    span.addEvent('stellar.retry', {
      'stellar.operation': operationName,
      'stellar.retry.attempt': attempt,
      'stellar.retry.max_retries': maxRetries,
      ...(error ? { 'stellar.error.message': error } : {}),
    });

    if (error) {
      this.logger.debug(`[Trace:Retry] ${operationName} attempt ${attempt}/${maxRetries} failed: ${error}`);
    }
  }

  /**
   * Add a custom span event for tracking important lifecycle moments.
   */
  addSpanEvent(eventName: string, attributes?: Record<string, string | number | boolean>): void {
    const span = trace.getActiveSpan();
    if (!span) return;
    span.addEvent(eventName, this.toAttributes(attributes || {}));
  }

  /**
   * Strip undefined values (OpenTelemetry doesn't accept them as attribute values).
   */
  private toAttributes(
    raw: Record<string, string | number | boolean | undefined>,
  ): Record<string, string | number | boolean> {
    const out: Record<string, string | number | boolean> = {};
    for (const [key, value] of Object.entries(raw)) {
      if (value !== undefined) {
        out[key] = value;
      }
    }
    return out;
  }
}
