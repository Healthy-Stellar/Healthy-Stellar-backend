import { BadRequestException } from '@nestjs/common';

export class FeeEstimationError extends BadRequestException {
  constructor(message: string, public readonly source: 'horizon' | 'calculation' = 'horizon') {
    super(`Fee estimation failed: ${message}`);
    this.name = 'FeeEstimationError';
  }
}
