import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotificationOutboxService } from './notification-outbox.service';
import {
  NotificationOutboxEntry,
  OutboxStatus,
} from '../entities/notification-outbox.entity';
import { NotificationsService } from './notifications.service';
import {
  NotificationEvent,
  NotificationEventType,
} from '../interfaces/notification-event.interface';
import { DataSource } from 'typeorm';

const mockEntry = (
  overrides?: Partial<NotificationOutboxEntry>,
): NotificationOutboxEntry => ({
  id: 'outbox-1',
  dedupe_key: 'tx-abc:new_record',
  payload: {
    eventType: NotificationEventType.RECORD_UPLOADED,
    actorId: 'actor-1',
    resourceId: 'record-1',
    timestamp: new Date().toISOString(),
    metadata: {},
  } as unknown as Record<string, unknown>,
  patient_id: 'patient-1',
  status: OutboxStatus.PENDING,
  attempts: 0,
  max_attempts: 5,
  next_attempt_at: null,
  last_error: null,
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
});

const mockEvent = (): NotificationEvent => ({
  eventType: NotificationEventType.RECORD_UPLOADED,
  actorId: 'actor-1',
  resourceId: 'record-1',
  timestamp: new Date(),
  metadata: {},
});

describe('NotificationOutboxService', () => {
  let service: NotificationOutboxService;
  let outboxRepo: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
  };
  let dataSource: { query: jest.Mock };
  let notificationsService: { notifyOnChainEvent: jest.Mock };

  beforeEach(async () => {
    outboxRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    };

    dataSource = {
      query: jest.fn(),
    };

    notificationsService = {
      notifyOnChainEvent: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationOutboxService,
        {
          provide: getRepositoryToken(NotificationOutboxEntry),
          useValue: outboxRepo,
        },
        {
          provide: DataSource,
          useValue: dataSource,
        },
        {
          provide: NotificationsService,
          useValue: notificationsService,
        },
      ],
    }).compile();

    service = module.get(NotificationOutboxService);
  });

  describe('enqueue', () => {
    it('persists a new outbox entry and attempts immediate delivery', async () => {
      const entry = mockEntry();
      outboxRepo.findOne.mockResolvedValue(null);
      outboxRepo.create.mockReturnValue(entry);
      outboxRepo.save.mockResolvedValue(entry);
      outboxRepo.update.mockResolvedValue({ affected: 1 });
      notificationsService.notifyOnChainEvent.mockResolvedValue(undefined);

      await service.enqueue('tx-abc:new_record', mockEvent(), 'patient-1');

      expect(outboxRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          dedupe_key: 'tx-abc:new_record',
          patient_id: 'patient-1',
          status: OutboxStatus.PENDING,
        }),
      );
      expect(notificationsService.notifyOnChainEvent).toHaveBeenCalledWith(
        NotificationEventType.RECORD_UPLOADED,
        'actor-1',
        'record-1',
        'patient-1',
        expect.any(Object),
      );
    });

    it('is idempotent — skips save when dedupe key already exists', async () => {
      const existing = mockEntry({ status: OutboxStatus.COMPLETED });
      outboxRepo.findOne.mockResolvedValue(existing);

      await service.enqueue('tx-abc:new_record', mockEvent(), 'patient-1');

      expect(outboxRepo.save).not.toHaveBeenCalled();
      expect(notificationsService.notifyOnChainEvent).not.toHaveBeenCalled();
    });

    it('handles race condition on unique constraint violation gracefully', async () => {
      outboxRepo.findOne.mockResolvedValue(null);
      outboxRepo.create.mockReturnValue(mockEntry());
      outboxRepo.save.mockRejectedValue(
        new Error(
          'duplicate key value violates unique constraint "UQ_notification_outbox_dedupe_key"',
        ),
      );

      // Should not throw
      await expect(
        service.enqueue('tx-abc:new_record', mockEvent(), 'patient-1'),
      ).resolves.toBeUndefined();
    });
  });

  describe('sweep', () => {
    it('processes pending entries and marks them completed', async () => {
      const entry = mockEntry();
      dataSource.query.mockResolvedValue([
        {
          ...entry,
          payload: JSON.stringify(entry.payload),
        },
      ]);
      outboxRepo.update.mockResolvedValue({ affected: 1 });
      notificationsService.notifyOnChainEvent.mockResolvedValue(undefined);

      await service.sweep();

      expect(notificationsService.notifyOnChainEvent).toHaveBeenCalledWith(
        NotificationEventType.RECORD_UPLOADED,
        'actor-1',
        'record-1',
        'patient-1',
        expect.any(Object),
      );
    });

    it('marks entry as permanently failed after max attempts', async () => {
      const entry = mockEntry({ attempts: 4, max_attempts: 5 });
      dataSource.query.mockResolvedValue([
        {
          ...entry,
          payload: JSON.stringify(entry.payload),
        },
      ]);
      outboxRepo.update.mockResolvedValue({ affected: 1 });
      notificationsService.notifyOnChainEvent.mockRejectedValue(
        new Error('PubSub unavailable'),
      );

      await service.sweep();

      expect(outboxRepo.update).toHaveBeenCalledWith(
        entry.id,
        expect.objectContaining({
          status: OutboxStatus.FAILED,
          attempts: 5,
          last_error: 'PubSub unavailable',
          next_attempt_at: null,
        }),
      );
    });

    it('schedules retry with exponential back-off on transient failure', async () => {
      const entry = mockEntry({ attempts: 1 });
      dataSource.query.mockResolvedValue([
        {
          ...entry,
          payload: JSON.stringify(entry.payload),
        },
      ]);
      outboxRepo.update.mockResolvedValue({ affected: 1 });
      notificationsService.notifyOnChainEvent.mockRejectedValue(
        new Error('Transient error'),
      );

      await service.sweep();

      expect(outboxRepo.update).toHaveBeenCalledWith(
        entry.id,
        expect.objectContaining({
          status: OutboxStatus.FAILED,
          attempts: 2,
          last_error: 'Transient error',
          next_attempt_at: expect.any(Date),
        }),
      );
    });

    it('does nothing when no entries are pending', async () => {
      dataSource.query.mockResolvedValue([]);

      await service.sweep();

      expect(notificationsService.notifyOnChainEvent).not.toHaveBeenCalled();
    });
  });
});