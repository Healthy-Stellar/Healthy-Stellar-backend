import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { NotificationsGateway } from '../notifications.gateway';
import { NotificationEventType } from '../interfaces/notification-event.interface';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let gateway: jest.Mocked<NotificationsGateway>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: NotificationsGateway,
          useValue: { emitNotification: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    gateway = module.get(NotificationsGateway);
  });

  it('should emit record accessed event', () => {
    service.emitRecordAccessed('actor-1', 'resource-1', { detail: 'test' });

    expect(gateway.emitNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: NotificationEventType.RECORD_ACCESSED,
        actorId: 'actor-1',
        resourceId: 'resource-1',
        metadata: { detail: 'test' },
      }),
    );
  });

  it('should emit access granted event', () => {
    service.emitAccessGranted('actor-1', 'resource-1');

    expect(gateway.emitNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: NotificationEventType.ACCESS_GRANTED,
        actorId: 'actor-1',
        resourceId: 'resource-1',
      }),
    );
  });

  it('should emit access revoked event', () => {
    service.emitAccessRevoked('actor-1', 'resource-1');

    expect(gateway.emitNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: NotificationEventType.ACCESS_REVOKED,
        actorId: 'actor-1',
        resourceId: 'resource-1',
      }),
    );
  });

  it('should emit record uploaded event', () => {
    service.emitRecordUploaded('actor-1', 'resource-1');

    expect(gateway.emitNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: NotificationEventType.RECORD_UPLOADED,
        actorId: 'actor-1',
        resourceId: 'resource-1',
      }),
    );
  });
});
