import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RecordSyncService, RECORD_DELETED_EVENT, RecordDeletedEvent } from './record-sync.service';
import { Record } from '../entities/record.entity';
import { RecordType } from '../dto/create-record.dto';

const makeRecord = (overrides: Partial<Record> = {}): Record =>
  ({
    id: 'rec-1',
    patientId: 'patient-1',
    providerId: null,
    cid: 'QmABC',
    stellarTxHash: 'tx-1',
    recordType: RecordType.LAB_RESULT,
    description: null,
    isDeleted: false,
    deletedOnChainAt: null,
    createdAt: new Date(),
    ...overrides,
  } as Record);

describe('RecordSyncService', () => {
  let service: RecordSyncService;
  let findOne: jest.Mock;
  let update: jest.Mock;

  beforeEach(async () => {
    findOne = jest.fn();
    update = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecordSyncService,
        {
          provide: getRepositoryToken(Record),
          useValue: { findOne, update },
        },
      ],
    }).compile();

    service = module.get<RecordSyncService>(RecordSyncService);
  });

  const event: RecordDeletedEvent = {
    recordId: 'rec-1',
    txHash: 'tx-del-1',
    deletedAt: new Date('2024-06-01T12:00:00Z'),
  };

  describe('handleRecordDeleted', () => {
    it('marks the record as deleted in the DB', async () => {
      findOne.mockResolvedValue(makeRecord());

      await service.handleRecordDeleted(event);

      expect(update).toHaveBeenCalledWith('rec-1', {
        isDeleted: true,
        deletedOnChainAt: event.deletedAt,
      });
    });

    it('is idempotent — skips update if already deleted', async () => {
      findOne.mockResolvedValue(makeRecord({ isDeleted: true }));

      await service.handleRecordDeleted(event);

      expect(update).not.toHaveBeenCalled();
    });

    it('skips gracefully when record not found in DB', async () => {
      findOne.mockResolvedValue(null);

      await expect(service.handleRecordDeleted(event)).resolves.not.toThrow();
      expect(update).not.toHaveBeenCalled();
    });
  });

  describe('markDeleted', () => {
    it('marks a record deleted and returns true', async () => {
      findOne.mockResolvedValue(makeRecord());

      const result = await service.markDeleted('rec-1', new Date('2024-06-01'));

      expect(result).toBe(true);
      expect(update).toHaveBeenCalledWith('rec-1', {
        isDeleted: true,
        deletedOnChainAt: expect.any(Date),
      });
    });

    it('returns false when record not found', async () => {
      findOne.mockResolvedValue(null);

      const result = await service.markDeleted('missing');

      expect(result).toBe(false);
      expect(update).not.toHaveBeenCalled();
    });

    it('returns false when record already deleted', async () => {
      findOne.mockResolvedValue(makeRecord({ isDeleted: true }));

      const result = await service.markDeleted('rec-1');

      expect(result).toBe(false);
      expect(update).not.toHaveBeenCalled();
    });
  });

  describe('RECORD_DELETED_EVENT constant', () => {
    it('has the correct event name', () => {
      expect(RECORD_DELETED_EVENT).toBe('chain.record_deleted');
    });
  });
});
