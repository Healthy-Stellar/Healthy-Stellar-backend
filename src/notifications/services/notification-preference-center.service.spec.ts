import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotificationPreferenceCenterService, DEFAULT_NOTIFICATION_CATEGORIES } from './notification-preference-center.service';
import {
  NotificationCategoryPreference,
  NotificationChannel,
  NotificationFrequency,
} from '../entities/notification-category-preference.entity';

describe('NotificationPreferenceCenterService', () => {
  let service: NotificationPreferenceCenterService;

  const mockRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((data) => data),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationPreferenceCenterService,
        { provide: getRepositoryToken(NotificationCategoryPreference), useValue: mockRepo },
      ],
    }).compile();

    service = module.get(NotificationPreferenceCenterService);
    jest.clearAllMocks();
  });

  describe('getPreferences', () => {
    it('creates defaults for categories with no preference on record', async () => {
      mockRepo.find.mockResolvedValue([]);
      mockRepo.save.mockImplementation((rows) => Promise.resolve(rows));

      const result = await service.getPreferences('user-1');

      expect(result).toHaveLength(DEFAULT_NOTIFICATION_CATEGORIES.length);
      expect(mockRepo.save).toHaveBeenCalled();
    });

    it('does not recreate categories that already have a preference', async () => {
      mockRepo.find.mockResolvedValue([
        { userId: 'user-1', category: 'new_record', channels: [NotificationChannel.EMAIL], enabled: true },
      ]);

      const result = await service.getPreferences('user-1');

      expect(result).toHaveLength(DEFAULT_NOTIFICATION_CATEGORIES.length);
      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ category: 'access_granted' })]),
      );
    });
  });

  describe('isChannelEnabledForCategory', () => {
    it('returns true when no preference is set (default allow)', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      const result = await service.isChannelEnabledForCategory('user-1', 'billing', NotificationChannel.EMAIL);

      expect(result).toBe(true);
    });

    it('returns false when the category is disabled', async () => {
      mockRepo.findOne.mockResolvedValue({ enabled: false, channels: [NotificationChannel.EMAIL] });

      const result = await service.isChannelEnabledForCategory('user-1', 'billing', NotificationChannel.EMAIL);

      expect(result).toBe(false);
    });

    it('returns false when the channel is not selected', async () => {
      mockRepo.findOne.mockResolvedValue({ enabled: true, channels: [NotificationChannel.IN_APP] });

      const result = await service.isChannelEnabledForCategory('user-1', 'billing', NotificationChannel.EMAIL);

      expect(result).toBe(false);
    });
  });

  describe('updateCategoryPreference', () => {
    it('updates channels, enabled and frequency', async () => {
      mockRepo.findOne.mockResolvedValue({
        userId: 'user-1',
        category: 'billing',
        channels: [NotificationChannel.EMAIL],
        enabled: true,
        frequency: NotificationFrequency.IMMEDIATE,
      });
      mockRepo.save.mockImplementation((pref) => Promise.resolve(pref));

      const result = await service.updateCategoryPreference('user-1', 'billing', {
        channels: [NotificationChannel.IN_APP],
        enabled: false,
        frequency: NotificationFrequency.DAILY_DIGEST,
      });

      expect(result.channels).toEqual([NotificationChannel.IN_APP]);
      expect(result.enabled).toBe(false);
      expect(result.frequency).toBe(NotificationFrequency.DAILY_DIGEST);
    });
  });
});
