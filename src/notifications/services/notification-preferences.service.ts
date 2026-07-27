import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationPreference } from '../entities/notification-preference.entity';

export interface UpdatePreferencesDto {
  webSocketEnabled?: boolean;
  emailEnabled?: boolean;
  newRecordNotifications?: boolean;
  accessGrantedNotifications?: boolean;
  accessRevokedNotifications?: boolean;
}

@Injectable()
export class NotificationPreferencesService {
  constructor(
    @InjectRepository(NotificationPreference)
    private readonly repo: Repository<NotificationPreference>,
  ) {}

  async getPreferences(patientId: string): Promise<NotificationPreference> {
    const existing = await this.repo.findOne({ where: { patientId } });
    if (existing) return existing;
    return this.repo.save(this.repo.create({ patientId }));
  }

  async updatePreferences(
    patientId: string,
    dto: UpdatePreferencesDto,
  ): Promise<NotificationPreference> {
    const prefs = await this.getPreferences(patientId);
    Object.assign(prefs, dto);
    return this.repo.save(prefs);
  }

  async isChannelEnabled(
    patientId: string,
    channel: 'webSocket' | 'email',
    eventType: 'newRecord' | 'accessGranted' | 'accessRevoked',
  ): Promise<boolean> {
    const prefs = await this.getPreferences(patientId);

    const channelEnabled =
      channel === 'email' ? prefs.emailEnabled : prefs.webSocketEnabled;
    if (!channelEnabled) return false;

    const eventMap: Record<string, boolean> = {
      newRecord: prefs.newRecordNotifications,
      accessGranted: prefs.accessGrantedNotifications,
      accessRevoked: prefs.accessRevokedNotifications,
    };

    return eventMap[eventType] ?? true;
  }
}
