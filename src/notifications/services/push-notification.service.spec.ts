import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PushNotificationService } from './push-notification.service';
import { DeviceToken, DevicePlatform } from '../entities/device-token.entity';

const mockRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
});

describe('PushNotificationService', () => {
  let service: PushNotificationService;
  let repo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PushNotificationService,
        { provide: getRepositoryToken(DeviceToken), useFactory: mockRepo },
      ],
    }).compile();

    service = module.get(PushNotificationService);
    repo = module.get(getRepositoryToken(DeviceToken));
  });

  describe('registerToken', () => {
    it('creates a new token when none exists', async () => {
      repo.findOne.mockResolvedValue(null);
      const created = { id: 'uuid-1', userId: 'u1', token: 'tok', platform: DevicePlatform.ANDROID, active: true };
      repo.create.mockReturnValue(created);
      repo.save.mockResolvedValue(created);

      const result = await service.registerToken('u1', 'tok', DevicePlatform.ANDROID);

      expect(repo.create).toHaveBeenCalledWith({ userId: 'u1', token: 'tok', platform: DevicePlatform.ANDROID, active: true });
      expect(result.active).toBe(true);
    });

    it('reactivates an existing inactive token', async () => {
      const existing = { id: 'uuid-1', userId: 'u1', token: 'tok', platform: DevicePlatform.IOS, active: false };
      repo.findOne.mockResolvedValue(existing);
      repo.save.mockResolvedValue({ ...existing, active: true });

      const result = await service.registerToken('u1', 'tok', DevicePlatform.IOS);

      expect(repo.create).not.toHaveBeenCalled();
      expect(result.active).toBe(true);
    });
  });

  describe('sendToUser', () => {
    it('sends a push to all active tokens and skips when none exist', async () => {
      repo.find.mockResolvedValue([]);
      await expect(service.sendToUser('u1', { title: 'Critical lab result', body: 'Review immediately' })).resolves.toBeUndefined();
    });

    it('deregisters a token when the provider signals it is invalid', async () => {
      const token = { id: 'uuid-1', userId: 'u1', token: 'bad-tok', platform: DevicePlatform.ANDROID, active: true };
      repo.find.mockResolvedValue([token]);

      // Spy on the private method via prototype to simulate an invalid-token response.
      const spy = jest
        .spyOn(service as any, 'sendViaPlatformProvider')
        .mockResolvedValue({ success: false, invalidToken: true });

      await service.sendToUser('u1', { title: 'Alert', body: 'Test' });

      expect(repo.update).toHaveBeenCalledWith({ id: 'uuid-1' }, { active: false });
      spy.mockRestore();
    });
  });
});
