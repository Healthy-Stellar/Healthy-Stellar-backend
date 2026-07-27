import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotificationPreferencesService } from './notification-preferences.service';
import { NotificationPreference } from '../entities/notification-preference.entity';

const mockPreference: NotificationPreference = {
  id: 'pref-1',
  patientId: 'patient-1',
  webSocketEnabled: true,
  emailEnabled: false,
  newRecordNotifications: true,
  accessGrantedNotifications: true,
  accessRevokedNotifications: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockRepo = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
};

describe('NotificationPreferencesService', () => {
  let service: NotificationPreferencesService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationPreferencesService,
        { provide: getRepositoryToken(NotificationPreference), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<NotificationPreferencesService>(NotificationPreferencesService);
  });

  describe('getPreferences', () => {
    it('should return existing preferences', async () => {
      mockRepo.findOne.mockResolvedValue(mockPreference);
      const result = await service.getPreferences('patient-1');
      expect(result).toEqual(mockPreference);
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('should create default preferences if none exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.create.mockReturnValue({ patientId: 'patient-1' });
      mockRepo.save.mockResolvedValue(mockPreference);

      const result = await service.getPreferences('patient-1');
      expect(mockRepo.create).toHaveBeenCalledWith({ patientId: 'patient-1' });
      expect(mockRepo.save).toHaveBeenCalled();
      expect(result.patientId).toBe('patient-1');
    });
  });

  describe('updatePreferences', () => {
    it('should update and save preferences', async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockPreference });
      const updated = { ...mockPreference, emailEnabled: true };
      mockRepo.save.mockResolvedValue(updated);

      const result = await service.updatePreferences('patient-1', { emailEnabled: true });
      expect(result.emailEnabled).toBe(true);
    });
  });

  describe('isChannelEnabled', () => {
    it('should return true for enabled webSocket + newRecord', async () => {
      mockRepo.findOne.mockResolvedValue(mockPreference);
      const result = await service.isChannelEnabled('patient-1', 'webSocket', 'newRecord');
      expect(result).toBe(true);
    });

    it('should return false when email channel is disabled', async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockPreference, emailEnabled: false });
      const result = await service.isChannelEnabled('patient-1', 'email', 'newRecord');
      expect(result).toBe(false);
    });

    it('should return false when specific event type is disabled', async () => {
      mockRepo.findOne.mockResolvedValue({
        ...mockPreference,
        accessRevokedNotifications: false,
      });
      const result = await service.isChannelEnabled('patient-1', 'webSocket', 'accessRevoked');
      expect(result).toBe(false);
    });
  });
});
