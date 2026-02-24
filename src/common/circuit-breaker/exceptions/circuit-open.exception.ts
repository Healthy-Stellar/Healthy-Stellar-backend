import { HttpException, HttpStatus } from '@nestjs/common';

export class CircuitOpenException extends HttpException {
  constructor(serviceName: string, retryAfterSeconds: number = 60) {
    super(
      {
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        message: `Service temporarily unavailable: ${serviceName} circuit breaker is open`,
        error: 'Service Unavailable',
        serviceName,
        retryAfter: retryAfterSeconds,
      },
      HttpStatus.SERVICE_UNAVAILABLE,
    );

    this.name = 'CircuitOpenException';
  }

  getRetryAfterSeconds(): number {
    const response = this.getResponse() as any;
    return response.retryAfter || 60;
  }
}
