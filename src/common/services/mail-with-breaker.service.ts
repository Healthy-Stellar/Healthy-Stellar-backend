import { Injectable, Logger } from '@nestjs/common';
import { CircuitBreakerService } from '../circuit-breaker/circuit-breaker.service';
import { BrokenCircuitError } from 'cockatiel';
import { CircuitOpenException } from '../circuit-breaker/exceptions/circuit-open.exception';
import { CIRCUIT_BREAKER_CONFIGS } from '../circuit-breaker/circuit-breaker.config';
import {
  MailService,
  Patient,
  Provider,
  MedicalRecord,
  SuspiciousAccessEvent,
} from '../../Email Notification Service for Critical Access Events/mail.service';

/**
 * Wrapper around MailService that adds circuit breaker protection
 */
@Injectable()
export class MailWithBreakerService {
  private readonly logger = new Logger(MailWithBreakerService.name);
  private readonly serviceName = 'mail';

  constructor(
    private readonly mailService: MailService,
    private readonly circuitBreaker: CircuitBreakerService,
  ) {}

  async sendAccessGrantedEmail(
    patient: Patient,
    grantee: Provider,
    record: MedicalRecord,
  ): Promise<void> {
    return this.executeWithBreaker(() =>
      this.mailService.sendAccessGrantedEmail(patient, grantee, record),
    );
  }

  async sendAccessRevokedEmail(
    patient: Patient,
    revokee: Provider,
    record: MedicalRecord,
  ): Promise<void> {
    return this.executeWithBreaker(() =>
      this.mailService.sendAccessRevokedEmail(patient, revokee, record),
    );
  }

  async sendRecordUploadedEmail(
    patient: Patient,
    record: MedicalRecord,
    uploadedBy?: Provider,
  ): Promise<void> {
    return this.executeWithBreaker(() =>
      this.mailService.sendRecordUploadedEmail(patient, record, uploadedBy),
    );
  }

  async sendSuspiciousAccessEmail(patient: Patient, event: SuspiciousAccessEvent): Promise<void> {
    return this.executeWithBreaker(() =>
      this.mailService.sendSuspiciousAccessEmail(patient, event),
    );
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
