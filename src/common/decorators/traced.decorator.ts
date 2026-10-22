import { trace, SpanStatusCode, SpanKind } from '@opentelemetry/api';

const tracer = trace.getTracer('healthy-stellar-services');

/**
 * Method decorator that wraps the decorated async service method in an
 * OpenTelemetry child span.
 *
 * Usage:
 *   @Traced()                          // span name = "ClassName.methodName"
 *   @Traced('records.upload')          // explicit span name
 *   @Traced('phi.access', { 'db.system': 'postgresql' })
 */
export function Traced(spanName?: string, extraAttributes: Record<string, string> = {}) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const original = descriptor.value;
    const name = spanName ?? `${target.constructor.name}.${propertyKey}`;

    descriptor.value = async function (...args: any[]) {
      const span = tracer.startSpan(name, {
        kind: SpanKind.INTERNAL,
        attributes: {
          'code.function':  propertyKey,
          'code.namespace': target.constructor.name,
          ...extraAttributes,
        },
      });

      try {
        const result = await original.apply(this, args);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (err: any) {
        span.recordException(err);
        span.setStatus({ code: SpanStatusCode.ERROR, message: err?.message });
        throw err;
      } finally {
        span.end();
      }
    };

    return descriptor;
  };
}
