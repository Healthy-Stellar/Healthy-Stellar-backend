import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';

import { RecordsService } from './records.service';
import { Record } from '../entities/record.entity';
import { IpfsService } from './ipfs.service';
import { StellarService } from './stellar.service';
import { RecordEventStoreService } from './record-event-store.service';
import { AccessControlService } from '../../access-control/services/access-control.service';
import { AuditLogService } from '../../common/services/audit-log.service';
import { RecordEventStoreService } from './record-event-store.service';
import { UserRole } from '../../auth/entities/user.entity';

describe('RecordsService', () => {
  let service: RecordsService;
  let repository: Repository<Record>;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    find: jest.fn(),
  };

  const ipfs = { upload: jest.fn() };

  const stellar = {
    anchorCid: jest.fn(),
    createShareLink: jest.fn(),
  };

  const mockAccessControlService = {
    findActiveEmergencyGrant: jest.fn(),
    canAccessRecord: jest.fn(),
  };

  const auditLog = { create: jest.fn() };

  const eventStore = {
    append: jest.fn(),
    getEvents: jest.fn(),
    replayToState: jest.fn(),
  };

  const mockEventStore = {
    append: jest.fn(),
    replayToState: jest.fn(),
    getEvents: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecordsService,
        {
          provide: getRepositoryToken(Record),
          useValue: mockRepository,
        },
        {
          provide: IpfsService,
          useValue: mockIpfsService,
        },
        {
          provide: StellarService,
          useValue: mockStellarService,
        },
        {
          provide: AccessControlService,
          useValue: mockAccessControlService,
        },
        {
          provide: AuditLogService,
          useValue: mockAuditLogService,
        },
        {
          provide: RecordEventStoreService,
          useValue: mockEventStore,
        },
      ],
    }).compile();

  afterEach(() => jest.clearAllMocks());

  // ── uploadRecord ─────────────────────────────────────────────────────────────
  describe('uploadRecord', () => {
    const dto = {
      patientId: 'patient-abc-123',
      recordType: RecordType.MEDICAL_REPORT,
      description: 'Annual check-up',
    };
    const buffer = Buffer.from('encrypted-payload');

    beforeEach(() => {
      mocks.ipfs.upload.mockResolvedValue('Qm-cid-new');
      mocks.stellar.anchorCid.mockResolvedValue('tx-hash-new');
      mocks.repo.create.mockReturnValue(SAVED_RECORD);
      mocks.repo.save.mockResolvedValue(SAVED_RECORD);
      mocks.eventStore.append.mockResolvedValue({});
    });

    it('success — returns recordId, cid, stellarTxHash', async () => {
      const result = await service.uploadRecord(dto, buffer);

      expect(result).toEqual({
        recordId: SAVED_RECORD.id,
        cid: SAVED_RECORD.cid,
        stellarTxHash: SAVED_RECORD.stellarTxHash,
      });
    });

    it('calls ipfs.upload with the encrypted buffer', async () => {
      await service.uploadRecord(dto, buffer);
      expect(mocks.ipfs.upload).toHaveBeenCalledWith(buffer);
    });

    it('calls stellar.anchorCid with patientId and the returned CID', async () => {
      await service.uploadRecord(dto, buffer);
      expect(mocks.stellar.anchorCid).toHaveBeenCalledWith(dto.patientId, 'Qm-cid-new');
    });

    it('appends RECORD_CREATED event with causedBy when provided', async () => {
      await service.uploadRecord(dto, buffer, 'user-actor-1');

      expect(mocks.eventStore.append).toHaveBeenCalledWith(
        SAVED_RECORD.id,
        RecordEventType.RECORD_CREATED,
        expect.objectContaining({ patientId: dto.patientId, cid: 'Qm-cid-new' }),
        'user-actor-1',
      );
    });

    it('appends RECORD_CREATED event with undefined causedBy when omitted', async () => {
      await service.uploadRecord(dto, buffer);

      expect(mocks.eventStore.append).toHaveBeenCalledWith(
        SAVED_RECORD.id,
        RecordEventType.RECORD_CREATED,
        expect.any(Object),
        undefined,
      );
    });

    it('stores null for description in event payload when description is undefined', async () => {
      const dtoNoDesc = { patientId: 'p-1', recordType: RecordType.LAB_RESULT };
      await service.uploadRecord(dtoNoDesc, buffer);

      expect(mocks.eventStore.append).toHaveBeenCalledWith(
        expect.any(String),
        RecordEventType.RECORD_CREATED,
        expect.objectContaining({ description: null }),
        undefined,
      );
    });

    it('IPFS failure — rejects before touching Stellar or the DB', async () => {
      mocks.ipfs.upload.mockRejectedValue(new Error('IPFS node unreachable'));

      await expect(service.uploadRecord(dto, buffer)).rejects.toThrow('IPFS node unreachable');

      expect(mocks.stellar.anchorCid).not.toHaveBeenCalled();
      expect(mocks.repo.save).not.toHaveBeenCalled();
      expect(mocks.eventStore.append).not.toHaveBeenCalled();
    });

    it('Stellar contract failure — rejects after IPFS but before DB save', async () => {
      mocks.stellar.anchorCid.mockRejectedValue(new Error('Stellar contract error'));

      await expect(service.uploadRecord(dto, buffer)).rejects.toThrow('Stellar contract error');

      expect(mocks.ipfs.upload).toHaveBeenCalled();
      expect(mocks.repo.save).not.toHaveBeenCalled();
      expect(mocks.eventStore.append).not.toHaveBeenCalled();
    });
  });

  // ── findOne ──────────────────────────────────────────────────────────────────
  describe('findOne', () => {
    it('returns the record when found without a requesterId', async () => {
      mocks.repo.findOne.mockResolvedValue(BASE_RECORD);

      const result = await service.findOne('record-1');

      expect(result).toEqual(BASE_RECORD);
      expect(mocks.accessControl.findActiveEmergencyGrant).not.toHaveBeenCalled();
      expect(mocks.auditLog.create).not.toHaveBeenCalled();
    });

    it('returns null when record is not found (no requesterId)', async () => {
      mocks.repo.findOne.mockResolvedValue(null);

      const result = await service.findOne('nonexistent');

      expect(result).toBeNull();
      expect(mocks.accessControl.findActiveEmergencyGrant).not.toHaveBeenCalled();
    });

    it('returns null when record is not found (with requesterId)', async () => {
      mocks.repo.findOne.mockResolvedValue(null);

      const result = await service.findOne('nonexistent', 'requester-1');

      expect(result).toBeNull();
      // record is null so the access-control branch is never entered
      expect(mocks.accessControl.findActiveEmergencyGrant).not.toHaveBeenCalled();
    });

    it('checks for emergency grant when record found and requesterId provided', async () => {
      mocks.repo.findOne.mockResolvedValue(BASE_RECORD);
      mocks.accessControl.findActiveEmergencyGrant.mockResolvedValue(null);

      await service.findOne('record-1', 'requester-1');

      expect(mocks.accessControl.findActiveEmergencyGrant).toHaveBeenCalledWith(
        BASE_RECORD.patientId,
        'requester-1',
        'record-1',
      );
    });

    it('does NOT write audit log when no emergency grant exists', async () => {
      mocks.repo.findOne.mockResolvedValue(BASE_RECORD);
      mocks.accessControl.findActiveEmergencyGrant.mockResolvedValue(null);

      await service.findOne('record-1', 'requester-1');

      expect(mocks.auditLog.create).not.toHaveBeenCalled();
    });

    it('writes EMERGENCY_ACCESS audit log when an active emergency grant exists', async () => {
      const emergencyGrant = { id: 'grant-99' };
      mocks.repo.findOne.mockResolvedValue(BASE_RECORD);
      mocks.accessControl.findActiveEmergencyGrant.mockResolvedValue(emergencyGrant);
      mocks.auditLog.create.mockResolvedValue({});

      await service.findOne('record-1', 'requester-1');

      expect(mocks.auditLog.create).toHaveBeenCalledWith({
        operation: 'EMERGENCY_ACCESS',
        entityType: 'records',
        entityId: 'record-1',
        userId: 'requester-1',
        status: 'success',
        newValues: {
          patientId: BASE_RECORD.patientId,
          grantId: 'grant-99',
          recordId: 'record-1',
        },
      });
    });
  });

  // ── findAll / getRecordsForPatient ────────────────────────────────────────────
  describe('findAll (getRecordsForPatient)', () => {
    const twoRecords: Record[] = [
      { ...BASE_RECORD, id: '1', recordType: RecordType.MEDICAL_REPORT },
      { ...BASE_RECORD, id: '2', recordType: RecordType.LAB_RESULT },
    ];

    beforeEach(() => {
      mocks.repo.findAndCount.mockResolvedValue([twoRecords, 2]);
    });

    // ── pagination ──────────────────────────────────────────────────────────
    it('defaults: page=1, limit=20, order=DESC, sortBy=createdAt', async () => {
      const result = await service.findAll({});

      expect(result.meta).toEqual({
        total: 2,
        page: 1,
        limit: 20,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      });
      expect(mocks.repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ take: 20, skip: 0 }),
      );
    });

    it('page 2 of 3 — hasNextPage=true, hasPreviousPage=true', async () => {
      mocks.repo.findAndCount.mockResolvedValue([twoRecords, 50]);

      const result = await service.findAll({ page: 2, limit: 20 });

      expect(result.meta).toMatchObject({
        page: 2,
        totalPages: 3,
        hasNextPage: true,
        hasPreviousPage: true,
      });
      expect(mocks.repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 20 }),
      );
    });

    it('last page — hasNextPage=false, hasPreviousPage=true', async () => {
      mocks.repo.findAndCount.mockResolvedValue([twoRecords, 40]);

      const result = await service.findAll({ page: 2, limit: 20 });

      expect(result.meta.hasNextPage).toBe(false);
      expect(result.meta.hasPreviousPage).toBe(true);
    });

    it('empty result set — totalPages=0, both flags false', async () => {
      mocks.repo.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.findAll({});

      expect(result.data).toEqual([]);
      expect(result.meta).toMatchObject({ total: 0, totalPages: 0, hasNextPage: false, hasPreviousPage: false });
    });

    it('totalPages rounds up correctly (45 records, limit 10 → 5 pages)', async () => {
      mocks.repo.findAndCount.mockResolvedValue([twoRecords, 45]);

      const result = await service.findAll({ limit: 10 });

      expect(result.meta.totalPages).toBe(5);
    });

    // ── type filter ─────────────────────────────────────────────────────────
    it('filters by recordType when provided', async () => {
      mocks.repo.findAndCount.mockResolvedValue([[twoRecords[0]], 1]);

      await service.findAll({ recordType: RecordType.MEDICAL_REPORT });

      expect(mocks.repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ recordType: RecordType.MEDICAL_REPORT }) }),
      );
    });

    it('does not include recordType in where clause when omitted', async () => {
      await service.findAll({});

      const call = mocks.repo.findAndCount.mock.calls[0][0];
      expect(call.where).not.toHaveProperty('recordType');
    });

    // ── patientId filter ────────────────────────────────────────────────────
    it('filters by patientId when provided', async () => {
      await service.findAll({ patientId: 'patient-abc-123' });

      expect(mocks.repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ patientId: 'patient-abc-123' }) }),
      );
    });

    it('does not include patientId in where clause when omitted', async () => {
      await service.findAll({});

      const call = mocks.repo.findAndCount.mock.calls[0][0];
      expect(call.where).not.toHaveProperty('patientId');
    });

    // ── date range branches ─────────────────────────────────────────────────
    it('applies Between filter when both fromDate and toDate are provided', async () => {
      await service.findAll({ fromDate: '2024-01-01T00:00:00Z', toDate: '2024-12-31T23:59:59Z' });

      const call = mocks.repo.findAndCount.mock.calls[0][0];
      expect(call.where.createdAt).toBeDefined();
    });

    it('applies Between(fromDate, now) when only fromDate is provided', async () => {
      await service.findAll({ fromDate: '2024-01-01T00:00:00Z' });

      const call = mocks.repo.findAndCount.mock.calls[0][0];
      expect(call.where.createdAt).toBeDefined();
    });

    it('applies Between(epoch, toDate) when only toDate is provided', async () => {
      await service.findAll({ toDate: '2024-12-31T23:59:59Z' });

      const call = mocks.repo.findAndCount.mock.calls[0][0];
      expect(call.where.createdAt).toBeDefined();
    });

    it('does not set createdAt filter when neither fromDate nor toDate provided', async () => {
      await service.findAll({});

      const call = mocks.repo.findAndCount.mock.calls[0][0];
      expect(call.where).not.toHaveProperty('createdAt');
    });

    // ── sort ────────────────────────────────────────────────────────────────
    it('sorts by createdAt ASC', async () => {
      await service.findAll({ sortBy: SortBy.CREATED_AT, order: SortOrder.ASC });

      expect(mocks.repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ order: { createdAt: 'ASC' } }),
      );
    });

    it('sorts by recordType DESC', async () => {
      await service.findAll({ sortBy: SortBy.RECORD_TYPE, order: SortOrder.DESC });

      expect(mocks.repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ order: { recordType: 'DESC' } }),
      );
    });

    it('sorts by patientId ASC', async () => {
      await service.findAll({ sortBy: SortBy.PATIENT_ID, order: SortOrder.ASC });

      expect(mocks.repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ order: { patientId: 'ASC' } }),
      );
    });

    // ── combined ────────────────────────────────────────────────────────────
    it('applies patientId + recordType + date range + pagination together', async () => {
      mocks.repo.findAndCount.mockResolvedValue([[twoRecords[0]], 1]);

      await service.findAll({
        page: 2,
        limit: 10,
        patientId: 'patient-abc-123',
        recordType: RecordType.LAB_RESULT,
        fromDate: '2024-01-01T00:00:00Z',
        toDate: '2024-12-31T23:59:59Z',
        sortBy: SortBy.CREATED_AT,
        order: SortOrder.ASC,
      });

      expect(mocks.repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
          order: { createdAt: 'ASC' },
          where: expect.objectContaining({
            patientId: 'patient-abc-123',
            recordType: RecordType.LAB_RESULT,
            createdAt: expect.any(Object),
          }),
        }),
      );
    });
  });

  // ── findRecent ───────────────────────────────────────────────────────────────
  describe('findRecent', () => {
    it('returns mapped DTOs with truncated address (>10 chars)', async () => {
      mocks.repo.find.mockResolvedValue([BASE_RECORD]);

      const result = await service.findRecent();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        recordId: BASE_RECORD.id,
        patientAddress: 'patien...123',
        providerAddress: 'System',
        recordType: BASE_RECORD.recordType,
        createdAt: BASE_RECORD.createdAt,
      });
    });

    it('does not truncate address of exactly 10 chars', async () => {
      mocks.repo.find.mockResolvedValue([{ ...BASE_RECORD, patientId: '1234567890' }]);

      const result = await service.findRecent();

      expect(result[0].patientAddress).toBe('1234567890');
    });

    it('does not truncate address shorter than 10 chars', async () => {
      mocks.repo.find.mockResolvedValue([{ ...BASE_RECORD, patientId: 'short' }]);

      const result = await service.findRecent();

      expect(result[0].patientAddress).toBe('short');
    });

    it('queries with take=50, order DESC, and 30s cache', async () => {
      mocks.repo.find.mockResolvedValue([]);

      await service.findRecent();

      expect(mocks.repo.find).toHaveBeenCalledWith({
        order: { createdAt: 'DESC' },
        take: 50,
        cache: 30000,
      });
    });

    it('returns empty array when no records exist', async () => {
      mocks.repo.find.mockResolvedValue([]);

      const result = await service.findRecent();

      expect(result).toEqual([]);
    });
  });

  // ── generateQrCode ───────────────────────────────────────────────────────────
  describe('generateQrCode', () => {
    it('throws NotFoundException when record does not exist', async () => {
      mocks.repo.findOne.mockResolvedValue(null);

      await expect(service.generateQrCode('nonexistent', 'patient-1')).rejects.toThrow(
        new NotFoundException('Record nonexistent not found'),
      );
      expect(mocks.stellar.createShareLink).not.toHaveBeenCalled();
    });

    it('returns QR data URL using APP_DOMAIN env variable when set', async () => {
      process.env.APP_DOMAIN = 'https://custom.domain.com';
      mocks.repo.findOne.mockResolvedValue(BASE_RECORD);
      mocks.stellar.createShareLink.mockResolvedValue('share-token-xyz');

      const result = await service.generateQrCode('record-1', 'patient-1');

      expect(result).toBe('data:image/png;base64,mockedQR');
      expect(QRCode.toDataURL).toHaveBeenCalledWith(
        'https://custom.domain.com/share/share-token-xyz',
      );

      delete process.env.APP_DOMAIN;
    });

    it('falls back to https://app.domain.com when APP_DOMAIN is not set', async () => {
      delete process.env.APP_DOMAIN;
      mocks.repo.findOne.mockResolvedValue(BASE_RECORD);
      mocks.stellar.createShareLink.mockResolvedValue('share-token-xyz');

      await service.generateQrCode('record-1', 'patient-1');

      expect(QRCode.toDataURL).toHaveBeenCalledWith(
        'https://app.domain.com/share/share-token-xyz',
      );
    });

    it('calls createShareLink with the correct id and patientId', async () => {
      mocks.repo.findOne.mockResolvedValue(BASE_RECORD);
      mocks.stellar.createShareLink.mockResolvedValue('token');

      await service.generateQrCode('record-1', 'patient-abc-123');

      expect(mocks.stellar.createShareLink).toHaveBeenCalledWith('record-1', 'patient-abc-123');
    });
  });

  // ── getStateFromEvents ───────────────────────────────────────────────────────
  describe('getStateFromEvents', () => {
    const liveState = {
      id: 'record-1',
      patientId: 'patient-abc-123',
      cid: 'Qm-cid-1',
      stellarTxHash: 'tx-1',
      recordType: RecordType.MEDICAL_REPORT,
      description: 'check-up',
      createdAt: new Date(),
      updatedAt: new Date(),
      sequenceNumber: 1,
      deleted: false,
    };

    it('returns the replayed state when record exists and is not deleted', async () => {
      mocks.eventStore.replayToState.mockResolvedValue(liveState);

      const result = await service.getStateFromEvents('record-1');

      expect(result).toEqual(liveState);
      expect(mocks.eventStore.replayToState).toHaveBeenCalledWith('record-1');
    });

    it('throws NotFoundException when replayToState returns null', async () => {
      mocks.eventStore.replayToState.mockResolvedValue(null);

      await expect(service.getStateFromEvents('record-1')).rejects.toThrow(
        new NotFoundException('Record record-1 not found in event store'),
      );
    });

    it('throws NotFoundException when state.deleted is true', async () => {
      mocks.eventStore.replayToState.mockResolvedValue({ ...liveState, deleted: true });

      await expect(service.getStateFromEvents('record-1')).rejects.toThrow(
        new NotFoundException('Record record-1 not found in event store'),
      );
    });
  });

  describe('findOneById', () => {
    const mockRecord: Record = {
      id: 'record-1',
      patientId: 'patient-1',
      cid: 'cid-secret',
      stellarTxHash: 'tx-1',
      recordType: RecordType.MEDICAL_REPORT,
      description: 'Test record',
      createdAt: new Date('2024-01-15'),
    };

    it('returns the full record including cid for the owning patient', async () => {
      mockRepository.findOne.mockResolvedValue(mockRecord);
      mockAccessControlService.canAccessRecord.mockResolvedValue(true);

      const result = await service.findOneById('record-1', 'patient-1', UserRole.PATIENT);

      expect(result).toEqual({
        id: 'record-1',
        patientId: 'patient-1',
        recordType: RecordType.MEDICAL_REPORT,
        description: 'Test record',
        stellarTxHash: 'tx-1',
        createdAt: mockRecord.createdAt,
        cid: 'cid-secret',
      });
      expect(mockAccessControlService.canAccessRecord).toHaveBeenCalledWith(
        'patient-1',
        'patient-1',
        UserRole.PATIENT,
        'record-1',
      );
      expect(mockAuditLogService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'RECORD_FETCH',
          entityId: 'record-1',
          userId: 'patient-1',
          newValues: expect.objectContaining({ accessType: 'owner' }),
        }),
      );
    });

    it('returns the record without cid for a grantee with an active grant', async () => {
      mockRepository.findOne.mockResolvedValue(mockRecord);
      mockAccessControlService.canAccessRecord.mockResolvedValue(true);

      const result = await service.findOneById('record-1', 'provider-1', UserRole.PHYSICIAN);

      expect(result).toEqual({
        id: 'record-1',
        patientId: 'patient-1',
        recordType: RecordType.MEDICAL_REPORT,
        description: 'Test record',
        stellarTxHash: 'tx-1',
        createdAt: mockRecord.createdAt,
      });
      expect(result).not.toHaveProperty('cid');
      expect(mockAuditLogService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'RECORD_FETCH',
          entityId: 'record-1',
          userId: 'provider-1',
          newValues: expect.objectContaining({ accessType: 'grantee' }),
        }),
      );
    });

    it('throws when a requester is not authorized to access the record', async () => {
      mockRepository.findOne.mockResolvedValue(mockRecord);
      mockAccessControlService.canAccessRecord.mockResolvedValue(false);

      await expect(
        service.findOneById('record-1', 'outsider-1', UserRole.PHYSICIAN),
      ).rejects.toThrow('Access denied');

      expect(mockAuditLogService.create).not.toHaveBeenCalled();
    });

    it('throws when the record does not exist', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(
        service.findOneById('missing-record', 'patient-1', UserRole.PATIENT),
      ).rejects.toThrow('Record missing-record not found');

      expect(mockAccessControlService.canAccessRecord).not.toHaveBeenCalled();
      expect(mockAuditLogService.create).not.toHaveBeenCalled();
    });
  });

  describe('uploadRecord', () => {
    it('should upload a record successfully', async () => {
      const dto = {
        patientId: 'patient-1',
        recordType: RecordType.MEDICAL_REPORT,
        description: 'Test record',
      };

      const buffer = Buffer.from('encrypted data');

      mockIpfsService.upload.mockResolvedValue('cid-123');
      mockStellarService.anchorCid.mockResolvedValue('tx-hash-456');
      mockRepository.create.mockReturnValue({
        id: 'record-789',
        ...dto,
        cid: 'cid-123',
        stellarTxHash: 'tx-hash-456',
      });
      mockRepository.save.mockResolvedValue({
        id: 'record-789',
        ...dto,
        cid: 'cid-123',
        stellarTxHash: 'tx-hash-456',
      });

    it('returns the event array when events exist', async () => {
      mocks.eventStore.getEvents.mockResolvedValue(mockEvents);

      const result = await service.getEventStream('record-1');

      expect(result).toEqual(mockEvents);
      expect(mocks.eventStore.getEvents).toHaveBeenCalledWith('record-1');
    });

    it('throws NotFoundException when no events exist for the record', async () => {
      mocks.eventStore.getEvents.mockResolvedValue([]);

      await expect(service.getEventStream('record-1')).rejects.toThrow(
        new NotFoundException('No events found for record record-1'),
      );
    });
  });
});
