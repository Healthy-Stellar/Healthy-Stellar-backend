import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  NotificationCategoryPreference,
  NotificationChannel,
  NotificationFrequency,
} from '../entities/notification-category-preference.entity';
import { UpdateCategoryPreferenceDto } from '../dto/notification-category-preference.dto';

export const DEFAULT_NOTIFICATION_CATEGORIES = [
  'new_record',
  'access_granted',
  'access_revoked',
  'billing',
  'system',
];

@Injectable()
export class NotificationPreferenceCenterService {
  constructor(
    @InjectRepository(NotificationCategoryPreference)
    private readonly repo: Repository<NotificationCategoryPreference>,
  ) {}

  /** Returns every category preference for a user, creating defaults for categories with none on record. */
  async getPreferences(userId: string): Promise<NotificationCategoryPreference[]> {
    const existing = await this.repo.find({ where: { userId } });
    const existingCategories = new Set(existing.map((p) => p.category));

    const missing = DEFAULT_NOTIFICATION_CATEGORIES.filter((c) => !existingCategories.has(c));
    if (missing.length === 0) {
      return existing;
    }

    const defaults = await this.repo.save(
      missing.map((category) =>
        this.repo.create({
          userId,
          category,
          channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP],
          enabled: true,
          frequency: NotificationFrequency.IMMEDIATE,
        }),
      ),
    );

    return [...existing, ...defaults];
  }

  async updateCategoryPreference(
    userId: string,
    category: string,
    dto: UpdateCategoryPreferenceDto,
  ): Promise<NotificationCategoryPreference> {
    let pref = await this.repo.findOne({ where: { userId, category } });

    if (!pref) {
      pref = this.repo.create({ userId, category });
    }

    pref.channels = dto.channels;
    if (dto.enabled !== undefined) pref.enabled = dto.enabled;
    if (dto.frequency !== undefined) pref.frequency = dto.frequency;

    return this.repo.save(pref);
  }

  /** Used by the notification dispatcher to decide whether to deliver on a given channel. */
  async isChannelEnabledForCategory(
    userId: string,
    category: string,
    channel: NotificationChannel,
  ): Promise<boolean> {
    const pref = await this.repo.findOne({ where: { userId, category } });
    if (!pref) {
      return true;
    }
    return pref.enabled && pref.channels.includes(channel);
  }

  async getDigestCategories(userId: string): Promise<NotificationCategoryPreference[]> {
    return this.repo.find({
      where: { userId, frequency: NotificationFrequency.DAILY_DIGEST, enabled: true },
    });
  }

  async getAllDigestSubscribers(): Promise<NotificationCategoryPreference[]> {
    return this.repo.find({ where: { frequency: NotificationFrequency.DAILY_DIGEST, enabled: true } });
  }
}
