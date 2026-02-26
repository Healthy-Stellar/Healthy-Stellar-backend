import { Injectable, LoggerService, Scope } from '@nestjs/common';
import { trace, context } from '@opentelemetry/api';

@Injectable({ scope: Scope.TRANSIENT })
export class TracingLogger implements LoggerService {
  private context?: string;

  setContext(context: string) {
    this.context = context;
  }

  private getTraceId(): string | undefined {
    const span = trace.getSpan(context.active());
    return span?.spanContext().traceId;
  }

  private formatMessage(message: any): string {
    const traceId = this.getTraceId();
    const contextStr = this.context ? `[${this.context}]` : '';
    const traceStr = traceId ? `[traceId: ${traceId}]` : '';
    return `${contextStr}${traceStr} ${message}`;
  }

  log(message: any, ...optionalParams: any[]) {
    console.log(this.formatMessage(message), ...optionalParams);
  }

  error(message: any, ...optionalParams: any[]) {
    console.error(this.formatMessage(message), ...optionalParams);
  }

  warn(message: any, ...optionalParams: any[]) {
    console.warn(this.formatMessage(message), ...optionalParams);
  }

  debug(message: any, ...optionalParams: any[]) {
    console.debug(this.formatMessage(message), ...optionalParams);
  }

  verbose(message: any, ...optionalParams: any[]) {
    console.log(this.formatMessage(message), ...optionalParams);
  }
}
