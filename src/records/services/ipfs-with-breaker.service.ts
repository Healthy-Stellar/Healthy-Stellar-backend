import { Injectable, Logger } from '@nestjs/common';
import { CircuitBreakerService } from '../../common/circuit-breaker/circuit-breaker.service';
import { IpfsService } from './ipfs.service';
import { BrokenCircuitError } from 'cockatiel';
import { CircuitOpenException } from '../../common/circuit-breaker/exceptions/circuit-open.exception';
import { CIRCUIT_BREAKER_CONFIGS } from '../../common/circuit-breaker/circuit-breaker.config';

/**
 * Wrapper around IpfsService that adds circuit breaker protection
 */
@Injectable()
export class IpfsWithBreakerService {
  private readonly logger = new Logger(IpfsWithBreakerService.name);
  private readonly serviceName = 'ipfs';

  constructor(
    private readonly ipfsService: IpfsService,
    private readonly circuitBreaker: CircuitBreakerService,
  ) {}

  async upload(buffer: Buffer): Promise<string> {
    return this.executeWithBreaker(() => this.ipfsService.upload(buffer));
  }

  private async executeWithBreaker<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await this.circuitBreaker.execute(this.serviceName, fn);
    } catch (error) {
      if (error instanceof BrokenCircuitError) {
        const config = CIRCUIT_BREAKER_CONFIGS[this.serviceName];
        throw new CircuitOpenException(this.serviceName, config.halfOpenAfter);
      }
      throw error;
    }
  }
}
