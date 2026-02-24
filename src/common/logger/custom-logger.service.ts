import { Injectable, Scope, LoggerService } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { getRequestContext } from '../middleware/request-context.middleware';

@Injectable({ scope: Scope.TRANSIENT })
export class CustomLoggerService implements LoggerService {
  constructor(private readonly logger: PinoLogger) {}

  setContext(context: string) {
    this.logger.setContext(context);
  }

  private enrichLogData(message: any, context?: string) {
    const requestContext = getRequestContext();
    
    return {
      message,
      context: context || this.logger.context,
      ...requestContext,
    };
  }

  log(message: any, context?: string) {
    this.logger.info(this.enrichLogData(message, context));
  }

  error(message: any, trace?: string, context?: string) {
    this.logger.error(
      {
        ...this.enrichLogData(message, context),
        trace,
      },
      message,
    );
  }

  warn(message: any, context?: string) {
    this.logger.warn(this.enrichLogData(message, context));
  }

  debug(message: any, context?: string) {
    this.logger.debug(this.enrichLogData(message, context));
  }

  verbose(message: any, context?: string) {
    this.logger.trace(this.enrichLogData(message, context));
  }

  // Additional methods for structured logging
  audit(event: string, data: any, context?: string) {
    this.logger.info(
      {
        ...this.enrichLogData(`AUDIT: ${event}`, context),
        auditEvent: event,
        auditData: data,
        logType: 'audit',
      },
      `AUDIT: ${event}`,
    );
  }

  security(event: string, data: any, context?: string) {
    this.logger.warn(
      {
        ...this.enrichLogData(`SECURITY: ${event}`, context),
        securityEvent: event,
        securityData: data,
        logType: 'security',
      },
      `SECURITY: ${event}`,
    );
  }

  performance(operation: string, duration: number, context?: string) {
    this.logger.info(
      {
        ...this.enrichLogData(`PERFORMANCE: ${operation}`, context),
        operation,
        duration,
        logType: 'performance',
      },
      `PERFORMANCE: ${operation} took ${duration}ms`,
    );
  }
}
