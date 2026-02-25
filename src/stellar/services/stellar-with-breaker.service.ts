import { Injectable, Logger } from '@nestjs/common';
import { CircuitBreakerService } from '../../common/circuit-breaker/circuit-breaker.service';
import { StellarService } from './stellar.service';
import {
  StellarTxResult,
  StellarVerifyResult,
} from '../interfaces/stellar-contract.interface';
import { BrokenCircuitError } from 'cockatiel';
import { CircuitOpenException } from '../../common/circuit-breaker/exceptions/circuit-open.exception';
import { CIRCUIT_BREAKER_CONFIGS } from '../../common/circuit-breaker/circuit-breaker.config';

/**
 * Wrapper around StellarService that adds circuit breaker protection
 */
@Injectable()
export class StellarWithBreakerService {
  private readonly logger = new Logger(StellarWithBreakerService.name);
  private readonly serviceName = 'stellar';

  constructor(
    private readonly stellarService: StellarService,
    private readonly circuitBreaker: CircuitBreakerService,
  ) {}

  async anchorRecord(patientId: string, cid: string): Promise<StellarTxResult> {
    return this.executeWithBreaker(() => this.stellarService.anchorRecord(patientId, cid));
  }

  async grantAccess(
    patientId: string,
    granteeId: string,
    recordId: string,
    expiresAt: Date,
  ): Promise<StellarTxResult> {
    return this.executeWithBreaker(() =>
      this.stellarService.grantAccess(patientId, granteeId, recordId, expiresAt),
    );
  }

  async revokeAccess(
    patientId: string,
    granteeId: string,
    recordId: string,
  ): Promise<StellarTxResult> {
    return this.executeWithBreaker(() =>
      this.stellarService.revokeAccess(patientId, granteeId, recordId),
    );
  }

  async verifyAccess(requesterId: string, recordId: string): Promise<StellarVerifyResult> {
    return this.executeWithBreaker(() => this.stellarService.verifyAccess(requesterId, recordId));
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
