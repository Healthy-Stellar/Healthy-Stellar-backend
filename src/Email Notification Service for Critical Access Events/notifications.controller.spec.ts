// src/notifications/notifications.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let service: jest.Mocked<NotificationsService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        {
          provide: NotificationsService,
          useValue: {
            unsubscribe: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<NotificationsController>(NotificationsController);
    service = module.get(NotificationsService);
  });

  it('unsubscribes patient when valid token is provided via query params', async () => {
    service.unsubscribe.mockResolvedValue({ message: 'You have been unsubscribed from email notifications.' });

    const result = await controller.unsubscribe('valid-token', 'patient-1');
    expect(service.unsubscribe).toHaveBeenCalledWith('patient-1', 'valid-token');
    expect(result.message).toContain('unsubscribed');
  });

  it('throws BadRequestException when token is missing', async () => {
    await expect(controller.unsubscribe(undefined, undefined)).rejects.toThrow(BadRequestException);
  });

  it('propagates UnauthorizedException from service on invalid token', async () => {
    service.unsubscribe.mockRejectedValue(new UnauthorizedException('Invalid unsubscribe token'));
    await expect(controller.unsubscribe('bad-token', 'patient-1')).rejects.toThrow(UnauthorizedException);
  });
});
