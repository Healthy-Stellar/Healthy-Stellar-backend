// src/notifications/notifications.service.ts
import {
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { Patient } from '../patients/entities/patient.entity';
import { NotificationChannel } from '../patients/dto/update-notification-preferences.dto';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,
  ) {}

  /**
   * Validates the unsubscribe token and removes the email channel from the
   * patient's notification preferences.
   *
   * Token is an HMAC of the patient ID — stateless and verifiable without a
   * separate token table.
   */
  async unsubscribe(patientId: string, token: string): Promise<{ message: string }> {
    const expectedToken = this.buildToken(patientId);

    // Constant-time comparison to prevent timing attacks.
    let tokensMatch: boolean;
    try {
      tokensMatch = crypto.timingSafeEqual(
        Buffer.from(token, 'hex'),
        Buffer.from(expectedToken, 'hex'),
      );
    } catch {
      // Buffer lengths differ → definitely not equal.
      tokensMatch = false;
    }

    if (!tokensMatch) {
      throw new UnauthorizedException('Invalid unsubscribe token');
    }

    const patient = await this.patientRepository.findOne({ where: { id: patientId } });
    if (!patient) {
      throw new NotFoundException(`Patient ${patientId} not found`);
    }

    // Remove the email channel from notification preferences.
    const prefs = patient.notificationPreferences ?? {
      newRecord: true,
      accessGranted: true,
      accessRevoked: true,
      appointmentReminder: true,
      channels: [],
    };

    prefs.channels = (prefs.channels ?? []).filter(
      (ch) => ch !== NotificationChannel.EMAIL,
    );

    patient.notificationPreferences = prefs;
    await this.patientRepository.save(patient);

    this.logger.log(`Patient ${patientId} unsubscribed from email notifications`);
    return { message: 'You have been unsubscribed from email notifications.' };
  }

  /**
   * Returns true if the patient has the email channel enabled.
   * Call this in MailService before sending to respect opt-outs.
   */
  async isSubscribed(patientId: string): Promise<boolean> {
    const patient = await this.patientRepository.findOne({
      where: { id: patientId },
      select: ['id', 'notificationPreferences'],
    });

    if (!patient) return false;

    const channels = patient.notificationPreferences?.channels ?? [];
    return channels.includes(NotificationChannel.EMAIL);
  }

  /** HMAC token used in unsubscribe links. */
  buildToken(patientId: string): string {
    return crypto
      .createHmac('sha256', this.configService.get<string>('UNSUBSCRIBE_SECRET', 'secret'))
      .update(patientId)
      .digest('hex');
  }
}
