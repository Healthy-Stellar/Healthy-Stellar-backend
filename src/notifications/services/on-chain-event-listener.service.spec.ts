import { Test, TestingModule } from '@nestjs/testing';
import { OnChainEventListenerService, OnChainEvent } from './on-chain-event-listener.service';
import { NotificationsService } from './notifications.service';
import { NotificationEventType } from '../interfaces/notification-event.interface';

describe('OnChainEventListenerService', () => {
  let service: OnChainEventListenerService;
  let notificationsService: jest.Mocked<NotificationsService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OnChainEventListenerService,
        {
          provide: NotificationsService,
          useValue: { notifyOnChainEvent: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    service = module.get<OnChainEventListenerService>(OnChainEventListenerService);
    notificationsService = module.get(NotificationsService);
  });

  it('should map new_record → RECORD_UPLOADED notification', async () => {
    const event: OnChainEvent = {
      type: 'new_record',
      patientId: 'patient-1',
      actorId: 'system',
      resourceId: 'record-1',
      txHash: 'tx-abc',
    };

    await service.handleOnChainEvent(event);

    expect(notificationsService.notifyOnChainEvent).toHaveBeenCalledWith(
      NotificationEventType.RECORD_UPLOADED,
      'system',
      'record-1',
      'patient-1',
      expect.objectContaining({ txHash: 'tx-abc' }),
    );
  });

  it('should map access_grant → ACCESS_GRANTED notification', async () => {
    const event: OnChainEvent = {
      type: 'access_grant',
      patientId: 'patient-1',
      actorId: 'doctor-1',
      resourceId: 'record-1',
    };

    await service.handleOnChainEvent(event);

    expect(notificationsService.notifyOnChainEvent).toHaveBeenCalledWith(
      NotificationEventType.ACCESS_GRANTED,
      'doctor-1',
      'record-1',
      'patient-1',
      expect.any(Object),
    );
  });

  it('should map access_revoke → ACCESS_REVOKED notification', async () => {
    const event: OnChainEvent = {
      type: 'access_revoke',
      patientId: 'patient-1',
      actorId: 'doctor-1',
      resourceId: 'record-1',
    };

    await service.handleOnChainEvent(event);

    expect(notificationsService.notifyOnChainEvent).toHaveBeenCalledWith(
      NotificationEventType.ACCESS_REVOKED,
      'doctor-1',
      'record-1',
      'patient-1',
      expect.any(Object),
    );
  });

  it('should warn and skip unknown event types', async () => {
    const event = {
      type: 'unknown_event' as any,
      patientId: 'patient-1',
      actorId: 'system',
      resourceId: 'record-1',
    };

    await service.handleOnChainEvent(event);

    expect(notificationsService.notifyOnChainEvent).not.toHaveBeenCalled();
  });
});
