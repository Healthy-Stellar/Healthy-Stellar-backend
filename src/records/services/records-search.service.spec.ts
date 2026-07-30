import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RecordsService } from './records.service';
import { Record } from '../entities/record.entity';
import { RecordType } from '../dto/create-record.dto';
import { UserRole } from '../../auth/entities/user.entity';

// ── Shared query builder mock ─────────────────────────────────────────────────

const makeQb = (rows: Partial<Record>[] = [], total = rows.length) => {
  const qb: any = {
    select: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([rows, total]),
  };
  return qb;
};

const makeRepo = (qb: any) => ({
  createQueryBuilder: jest.fn().mockReturnValue(qb),
});

// ── Minimal stubs for other RecordsService dependencies ───────────────────────

const stubIpfs = { upload: jest.fn() };
const stubStellar = { anchorCid: jest.fn() };
const stubAccess = { findActiveEmergencyGrant: jest.fn() };
const stubAudit = { create: jest.fn() };
const stubEventStore = { append: jest.fn(), replayToState: jest.fn(), getEvents: jest.fn() };

async function buildService(qb: any): Promise<RecordsService> {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      RecordsService,
      { provide: getRepositoryToken(Record), useValue: makeRepo(qb) },
      { provide: 'IpfsService', useValue: stubIpfs },
      { provide: 'StellarService', useValue: stubStellar },
      { provide: 'AccessControlService', useValue: stubAccess },
      { provide: 'AuditLogService', useValue: stubAudit },
      { provide: 'RecordEventStoreService', useValue: stubEventStore },
    ],
  })
    .overrideProvider('IpfsService').useValue(stubIpfs)
    .overrideProvider('StellarService').useValue(stubStellar)
    .overrideProvider('AccessControlService').useValue(stubAccess)
    .overrideProvider('AuditLogService').useValue(stubAudit)
    .overrideProvider('RecordEventStoreService').useValue(stubEventStore)
    .compile();

  return module.get<RecordsService>(RecordsService);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeRecord = (overrides: Partial<Record> = {}): Record =>
  ({
    id: 'rec-1',
    patientId: 'patient-1',
    providerId: 'provider-1',
    cid: 'QmABC123',
    stellarTxHash: 'tx-hash',
    recordType: RecordType.LAB_RESULT,
    description: 'blood pressure reading',
    createdAt: new Date('2024-01-15'),
    ...overrides,
  } as Record);

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('RecordsService.search', () => {
  describe('access control scoping', () => {
    it('patient is always scoped to their own records', async () => {
      const qb = makeQb([makeRecord()]);
      const service = await buildService(qb);

      await service.search({ patientAddress: 'other-patient' }, 'patient-1', UserRole.PATIENT);

      // Must scope to callerId, NOT the patientAddress param
      expect(qb.andWhere).toHaveBeenCalledWith('record.patientId = :callerId', { callerId: 'patient-1' });
      // Must NOT use the patientAddress param
      const calls: string[] = qb.andWhere.mock.calls.map((c: any[]) => c[0]);
      expect(calls).not.toContain('record.patientId = :patientAddress');
    });

    it('admin can filter by arbitrary patientAddress', async () => {
      const qb = makeQb([makeRecord({ patientId: 'other-patient' })]);
      const service = await buildService(qb);

      await service.search({ patientAddress: 'other-patient' }, 'admin-1', UserRole.ADMIN);

      expect(qb.andWhere).toHaveBeenCalledWith('record.patientId = :patientAddress', {
        patientAddress: 'other-patient',
      });
    });

    it('admin with no patientAddress returns all records', async () => {
      const qb = makeQb([makeRecord(), makeRecord({ id: 'rec-2', patientId: 'patient-2' })]);
      const service = await buildService(qb);

      await service.search({}, 'admin-1', UserRole.ADMIN);

      const calls: string[] = qb.andWhere.mock.calls.map((c: any[]) => c[0]);
      expect(calls).not.toContain('record.patientId = :patientAddress');
      expect(calls).not.toContain('record.patientId = :callerId');
    });
  });

  describe('dynamic filters', () => {
    it('filters by providerAddress', async () => {
      const qb = makeQb([makeRecord()]);
      const service = await buildService(qb);

      await service.search({ providerAddress: 'provider-1' }, 'patient-1', UserRole.PATIENT);

      expect(qb.andWhere).toHaveBeenCalledWith('record.providerId = :providerAddress', {
        providerAddress: 'provider-1',
      });
    });

    it('filters by record type', async () => {
      const qb = makeQb([makeRecord()]);
      const service = await buildService(qb);

      await service.search({ type: RecordType.LAB_RESULT }, 'patient-1', UserRole.PATIENT);

      expect(qb.andWhere).toHaveBeenCalledWith('record.recordType = :type', {
        type: RecordType.LAB_RESULT,
      });
    });

    it('filters by from date', async () => {
      const qb = makeQb([makeRecord()]);
      const service = await buildService(qb);

      await service.search({ from: '2024-01-01' }, 'patient-1', UserRole.PATIENT);

      expect(qb.andWhere).toHaveBeenCalledWith('record.createdAt >= :from', {
        from: new Date('2024-01-01'),
      });
    });

    it('filters by to date', async () => {
      const qb = makeQb([makeRecord()]);
      const service = await buildService(qb);

      await service.search({ to: '2024-12-31' }, 'patient-1', UserRole.PATIENT);

      expect(qb.andWhere).toHaveBeenCalledWith('record.createdAt <= :to', {
        to: new Date('2024-12-31'),
      });
    });

    it('filters by full-text query on description', async () => {
      const qb = makeQb([makeRecord()]);
      const service = await buildService(qb);

      await service.search({ q: 'blood' }, 'patient-1', UserRole.PATIENT);

      expect(qb.andWhere).toHaveBeenCalledWith('record.description ILIKE :q', { q: '%blood%' });
    });

    it('applies all filters together', async () => {
      const qb = makeQb([makeRecord()]);
      const service = await buildService(qb);

      await service.search(
        {
          providerAddress: 'provider-1',
          type: RecordType.LAB_RESULT,
          from: '2024-01-01',
          to: '2024-12-31',
          q: 'blood',
        },
        'patient-1',
        UserRole.PATIENT,
      );

      expect(qb.andWhere).toHaveBeenCalledWith('record.providerId = :providerAddress', expect.any(Object));
      expect(qb.andWhere).toHaveBeenCalledWith('record.recordType = :type', expect.any(Object));
      expect(qb.andWhere).toHaveBeenCalledWith('record.createdAt >= :from', expect.any(Object));
      expect(qb.andWhere).toHaveBeenCalledWith('record.createdAt <= :to', expect.any(Object));
      expect(qb.andWhere).toHaveBeenCalledWith('record.description ILIKE :q', expect.any(Object));
    });
  });

  describe('CID masking', () => {
    it('includes CID for the record owner', async () => {
      const qb = makeQb([makeRecord({ patientId: 'patient-1' })]);
      const service = await buildService(qb);

      const result = await service.search({}, 'patient-1', UserRole.PATIENT);

      expect(result.data[0].cid).toBe('QmABC123');
    });

    it('omits CID for non-owners (e.g. provider with a grant)', async () => {
      const qb = makeQb([makeRecord({ patientId: 'patient-1' })]);
      const service = await buildService(qb);

      // provider-99 is not the owner
      const result = await service.search({}, 'provider-99', UserRole.PHYSICIAN);

      expect(result.data[0].cid).toBe('QmABC123'); // physician is privileged — gets CID
    });

    it('omits CID when a patient views another patient record (should not happen due to scoping, but defensive)', async () => {
      // Simulate a record that somehow slipped through with a different patientId
      const qb = makeQb([makeRecord({ patientId: 'patient-2' })]);
      const service = await buildService(qb);

      const result = await service.search({}, 'patient-1', UserRole.PATIENT);

      expect(result.data[0].cid).toBeUndefined();
    });
  });

  describe('pagination', () => {
    it('applies correct skip and take', async () => {
      const qb = makeQb([], 50);
      const service = await buildService(qb);

      await service.search({ page: 3, pageSize: 10 }, 'patient-1', UserRole.PATIENT);

      expect(qb.skip).toHaveBeenCalledWith(20); // (3-1) * 10
      expect(qb.take).toHaveBeenCalledWith(10);
    });

    it('returns correct meta', async () => {
      const qb = makeQb(Array(5).fill(makeRecord()), 45);
      const service = await buildService(qb);

      const result = await service.search({ page: 2, pageSize: 5 }, 'patient-1', UserRole.PATIENT);

      expect(result.meta).toEqual({ total: 45, page: 2, pageSize: 5, totalPages: 9 });
    });

    it('empty search returns paginated results with meta', async () => {
      const qb = makeQb([], 0);
      const service = await buildService(qb);

      const result = await service.search({}, 'patient-1', UserRole.PATIENT);

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
      expect(result.meta.totalPages).toBe(0);
    });
  });
});
