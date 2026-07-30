import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource } from 'typeorm';

import { RecordVersionService } from './record-version.service';
import { RecordVersion } from '../entities/record-version.entity';
import { Record } from '../entities/record.entity';
import { IpfsService } from './ipfs.service';
import { StellarService } from './stellar.service';
import { AccessControlService } from '../../access-control/services/access-control.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { RecordEventStoreService } from './record-event-store.service';
import { RecordType } from '../dto/create-record.dto';
import { AmendRecordDto } from '../dto/amend-record.dto';

// ── Shared fixtures ────────────────────────────────────────────────────────────

const PATIENT_ID = 'patient-001';
const RECORD_ID = 'record-001';
const OTHER_USER_ID = 'other-user-999';

const BASE_RECORD: Partial<Record> = {
  id: RECORD_ID,
  patientId: PATIENT_ID,
  cid: 'Qm-cid-v1',
  stellarTxHash: 'stellar-tx-v1',
  recordType: RecordType.LAB_RESULT,
  description: 'Lipid panel',
  isDeleted: false,
  createdAt: new Date('2024-01-01T00:00:00Z'),
};

const V1: RecordVersion = {
  id: 'ver-001',
  recordId: RECORD_ID,
  version: 1,
  cid: 'Qm-cid-v1',
  encryptedDek: null,
  stellarTxHash: 'stellar-tx-v1',
  amendedBy: PATIENT_ID,
  amendmentReason: 'Initial upload',
  createdAt: new Date('2024-01-01T00:00:00Z'),
};

const V2: RecordVersion = {
  id: 'ver-002',
  recordId: RECORD_ID,
  version: 2,
  cid: 'Qm-cid-v2',
  encryptedDek: null,
  stellarTxHash: 'stellar-tx-v2',
  amendedBy: PATIENT_ID,
  amendmentReason: 'Corrected cholesterol value after recalibration of analyzer',
  createdAt: new Date('2024-02-01T00:00:00Z'),
};

// ── Mock factories ─────────────────────────────────────────────────────────────

function makeMocks() {
  const versionRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
  };

  const recordRepo = {
    findOne: jest.fn(),
  };

  const ipfs = { upload: jest.fn().mockResolvedValue('Qm-cid-v2') };
  const stellar = { anchorCid: jest.fn().mockResolvedValue('stellar-tx-v2') };

  const accessControl = {
    verifyAccess: jest.fn().mockResolvedValue(true),
    findActiveEmergencyGrant: jest.fn().mockResolvedValue(null),
    getPatientGrants: jest.fn().mockResolvedValue([]),
  };

  const notifications = { emitRecordAmended: jest.fn() };

  const eventStore = { append: jest.fn().mockResolvedValue(undefined) };

  const eventEmitter = { emit: jest.fn() };

  // DataSource mock — simulates the transaction by calling the callback immediately
  const dataSource = {
    transaction: jest.fn().mockImplementation(async (cb: (manager: any) => any) => {
      const manager = {
        createQueryBuilder: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          setLock: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(V1), // last version is v1
        }),
        create: jest.fn().mockImplementation((_cls: any, data: any) => data),
        save: jest.fn().mockImplementation((_cls: any, data: any) =>
          Promise.resolve({ ...data, id: 'ver-002', version: 2, createdAt: V2.createdAt }),
        ),
        update: jest.fn().mockResolvedValue(undefined),
      };
      return cb(manager);
    }),
  };

  return { versionRepo, recordRepo, ipfs, stellar, accessControl, notifications, eventStore, eventEmitter, dataSource };
}

async function buildModule(mocks: ReturnType<typeof makeMocks>) {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      RecordVersionService,
      { provide: getRepositoryToken(RecordVersion), useValue: mocks.versionRepo },
      { provide: getRepositoryToken(Record), useValue: mocks.recordRepo },
      { provide: IpfsService, useValue: mocks.ipfs },
      { provide: StellarService, useValue: mocks.stellar },
      { provide: AccessControlService, useValue: mocks.accessControl },
      { provide: NotificationsService, useValue: mocks.notifications },
      { provide: RecordEventStoreService, useValue: mocks.eventStore },
      { provide: EventEmitter2, useValue: mocks.eventEmitter },
      { provide: DataSource, useValue: mocks.dataSource },
    ],
  }).compile();

  return module.get<RecordVersionService>(RecordVersionService);
}

// ── Test suites ────────────────────────────────────────────────────────────────

describe('RecordVersionService', () => {
  let service: RecordVersionService;
  let mocks: ReturnType<typeof makeMocks>;

  beforeEach(async () => {
    mocks = makeMocks();
    service = await buildModule(mocks);
  });

  // ── createInitialVersion ─────────────────────────────────────────────────────

  describe('createInitialVersion', () => {
    it('creates version 1 with "Initial upload" reason', async () => {
      mocks.versionRepo.create.mockReturnValue(V1);
      mocks.versionRepo.save.mockResolvedValue(V1);

      const result = await service.createInitialVersion(
        RECORD_ID,
        'Qm-cid-v1',
        'stellar-tx-v1',
        PATIENT_ID,
      );

      expect(mocks.versionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ version: 1, amendmentReason: 'Initial upload' }),
      );
      expect(result.version).toBe(1);
    });
  });

  // ── amend ────────────────────────────────────────────────────────────────────

  describe('amend', () => {
    const dto: AmendRecordDto = {
      amendmentReason: 'Corrected cholesterol value after recalibration of analyzer',
    };

    beforeEach(() => {
      mocks.recordRepo.findOne.mockResolvedValue(BASE_RECORD);
    });

    it('(v1→v2) uploads to IPFS, anchors on Stellar, saves version 2', async () => {
      const result = await service.amend(RECORD_ID, dto, Buffer.from('encrypted'), PATIENT_ID);

      expect(mocks.ipfs.upload).toHaveBeenCalledWith(Buffer.from('encrypted'));
      expect(mocks.stellar.anchorCid).toHaveBeenCalledWith(PATIENT_ID, 'Qm-cid-v2');
      expect(result.version).toBe(2);
      expect(result.cid).toBe('Qm-cid-v2');
    });

    it('(v2→v3) assigns sequential version numbers', async () => {
      // Override transaction to pretend v2 is the last version
      mocks.dataSource.transaction.mockImplementation(async (cb: (manager: any) => any) => {
        const manager = {
          createQueryBuilder: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockReturnThis(),
            setLock: jest.fn().mockReturnThis(),
            getOne: jest.fn().mockResolvedValue(V2), // last version is v2
          }),
          create: jest.fn().mockImplementation((_cls: any, data: any) => data),
          save: jest.fn().mockImplementation((_cls: any, data: any) =>
            Promise.resolve({ ...data, id: 'ver-003', version: 3 }),
          ),
          update: jest.fn().mockResolvedValue(undefined),
        };
        return cb(manager);
      });

      const result = await service.amend(RECORD_ID, dto, Buffer.from('encrypted-v3'), PATIENT_ID);
      expect(result.version).toBe(3);
    });

    it('dispatches RecordAmended domain event', async () => {
      await service.amend(RECORD_ID, dto, Buffer.from('encrypted'), PATIENT_ID);
      expect(mocks.eventEmitter.emit).toHaveBeenCalledWith('RecordAmended', expect.objectContaining({ aggregateId: RECORD_ID }));
    });

    it('appends RECORD_AMENDED to the event store', async () => {
      await service.amend(RECORD_ID, dto, Buffer.from('encrypted'), PATIENT_ID);
      expect(mocks.eventStore.append).toHaveBeenCalledWith(
        RECORD_ID,
        'RECORD_AMENDED',
        expect.objectContaining({ version: 2, amendmentReason: dto.amendmentReason }),
        PATIENT_ID,
      );
    });

    it('(unauthorized) throws ForbiddenException when requester is not the patient', async () => {
      await expect(
        service.amend(RECORD_ID, dto, Buffer.from('encrypted'), OTHER_USER_ID),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when record does not exist', async () => {
      mocks.recordRepo.findOne.mockResolvedValue(null);
      await expect(
        service.amend(RECORD_ID, dto, Buffer.from('encrypted'), PATIENT_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('notifies active grantees after amendment', async () => {
      mocks.accessControl.getPatientGrants.mockResolvedValue([
        { granteeId: 'grantee-001', recordIds: [RECORD_ID], expiresAt: null },
      ]);

      await service.amend(RECORD_ID, dto, Buffer.from('encrypted'), PATIENT_ID);

      expect(mocks.notifications.emitRecordAmended).toHaveBeenCalledWith(
        PATIENT_ID,
        RECORD_ID,
        expect.objectContaining({ targetUserId: 'grantee-001' }),
      );
    });
  });

  // ── getVersions ──────────────────────────────────────────────────────────────

  describe('getVersions', () => {
    beforeEach(() => {
      mocks.recordRepo.findOne.mockResolvedValue(BASE_RECORD);
      mocks.versionRepo.findAndCount.mockResolvedValue([[V1, V2], 2]);
    });

    it('returns paginated version list with metadata (no file content)', async () => {
      const result = await service.getVersions(RECORD_ID, PATIENT_ID, 1, 20);

      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
      // cid is part of metadata — it is returned
      expect(result.data[0].cid).toBe(V1.cid);
    });

    it('throws ForbiddenException when requester lacks access', async () => {
      mocks.accessControl.verifyAccess.mockResolvedValue(false);
      mocks.accessControl.findActiveEmergencyGrant.mockResolvedValue(null);

      await expect(service.getVersions(RECORD_ID, OTHER_USER_ID, 1, 20)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ── getVersion ───────────────────────────────────────────────────────────────

  describe('getVersion', () => {
    beforeEach(() => {
      mocks.recordRepo.findOne.mockResolvedValue(BASE_RECORD);
      mocks.versionRepo.findOne.mockResolvedValue(V1);
    });

    it('retrieves a specific version', async () => {
      const result = await service.getVersion(RECORD_ID, 1, PATIENT_ID);
      expect(result.version).toBe(1);
      expect(result.cid).toBe(V1.cid);
    });

    it('throws NotFoundException when version does not exist', async () => {
      mocks.versionRepo.findOne.mockResolvedValue(null);

      await expect(service.getVersion(RECORD_ID, 99, PATIENT_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('allows access for an active grantee', async () => {
      mocks.accessControl.verifyAccess.mockResolvedValue(true);

      const result = await service.getVersion(RECORD_ID, 1, 'grantee-001');
      expect(result).toBeDefined();
    });
  });
});
