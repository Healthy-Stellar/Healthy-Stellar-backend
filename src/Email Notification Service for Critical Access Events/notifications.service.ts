// src/notifications/notifications.service.ts
import { Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

// NOTE: Replace `Patient` with your actual TypeORM entity
// This assumes you have a Patient entity with `id`, `email`, `emailNotificationsEnabled`, `unsubscribeToken`
// Adjust the import path to match your project structure
// import { Patient } from '../patients/patient.entity';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly configService: ConfigService,
    // @InjectRepository(Patient) private readonly patientRepository: Repository<Patient>,
  ) {}

  /**
   * Validates the unsubscribe token and disables notifications for the patient.
   * Token is an HMAC of the patient ID — stateless and verifiable without DB lookup.
   */
  async unsubscribe(patientId: string, token: string): Promise<{ message: string }> {
    const expectedToken = crypto
      .createHmac('sha256', this.configService.get('UNSUBSCRIBE_SECRET', 'secret'))
      .update(patientId)
      .digest('hex');

    // Constant-time comparison to prevent timing attacks
    const tokensMatch = crypto.timingSafeEqual(
      Buffer.from(token),
      Buffer.from(expectedToken),
    );

    if (!tokensMatch) {
      throw new UnauthorizedException('Invalid unsubscribe token');
    }

    // TODO: Persist the unsubscribe preference in your database
    // Example:
    // const patient = await this.patientRepository.findOne({ where: { id: patientId } });
    // if (!patient) throw new NotFoundException(`Patient ${patientId} not found`);
    // patient.emailNotificationsEnabled = false;
    // await this.patientRepository.save(patient);

    this.logger.log(`Patient ${patientId} unsubscribed from email notifications`);
    return { message: 'You have been unsubscribed from email notifications.' };
  }

  /**
   * Check if a patient has opted out — call this in MailService before sending
   */
  async isSubscribed(patientId: string): Promise<boolean> {
    // TODO: implement actual DB check
    // const patient = await this.patientRepository.findOne({ where: { id: patientId } });
    // return patient?.emailNotificationsEnabled ?? true;
    return true;
  }
}
