import { ExceptionFilter, Catch, ArgumentsHost, Logger } from '@nestjs/common';
import { Response } from 'express';
import { CircuitOpenException } from '../exceptions/circuit-open.exception';
import { BrokenCircuitError } from 'cockatiel';

@Catch(BrokenCircuitError, CircuitOpenException)
export class CircuitBreakerExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(CircuitBreakerExceptionFilter.name);

  catch(exception: BrokenCircuitError | CircuitOpenException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let retryAfter = 60;
    let serviceName = 'unknown';

    if (exception instanceof CircuitOpenException) {
      retryAfter = exception.getRetryAfterSeconds();
      const exceptionResponse = exception.getResponse() as any;
      serviceName = exceptionResponse.serviceName || 'unknown';
    } else if (exception instanceof BrokenCircuitError) {
      // Extract service name from error message if possible
      serviceName = 'external-service';
    }

    this.logger.warn(
      `Circuit breaker open - returning 503 for service: ${serviceName}, retry after: ${retryAfter}s`,
    );

    response
      .status(503)
      .header('Retry-After', retryAfter.toString())
      .json({
        statusCode: 503,
        message: `Service temporarily unavailable: ${serviceName} circuit breaker is open`,
        error: 'Service Unavailable',
        retryAfter,
        timestamp: new Date().toISOString(),
      });
  }
}
