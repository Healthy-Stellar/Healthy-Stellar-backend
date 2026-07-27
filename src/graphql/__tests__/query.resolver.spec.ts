import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import {
  QueryResolver,
  MedicalRecordFieldResolver,
  AccessGrantFieldResolver,
  AuditLogFieldResolver,
} from '../resolvers/query.resolver';
import { UserDataLoader } from '../dataloaders/user.dataloader';
import { RecordDataLoader } from '../dataloaders/record.dataloader';
import { MedicalRecordsService } from '../../records/services/medical-records.service';
import { AccessGrantsService } from '../../records/services/access-grants.service';
import { AuditLogService } from '../../records/services/audit-log.service';
import { UsersService } from '../../users/users.service';
import { GrantStatus, UserRole, RecordType } from '../enums';
import { buildConnection } from '../utils/pagination.util';

/* ─── Shared stubs ─────────────────────────────────────────────────── */

const mockUser = {
  id: 'user-1',
  email: 'patient@example.com',
  firstName: 'Ada',
  lastName: 'Lovelace',
  role: UserRole.PATIENT,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
};

const mockProvider = {
  id: 'prov-1',
  email: 'dr.house@example.com',
  firstName: 'Gregory',
  lastName: 'House',
  role: UserRole.PROVIDER,
  specialty: 'Diagnostics',
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
};

const mockRecord = {
  id: 'rec-1',
  title: 'Blood Panel Q1',
  recordType: RecordType.LAB_RESULT,
  fileUrl: 'https://cdn.example.com/rec-1.pdf',
  patientId: 'user-1',
  uploadedById: 'prov-1',
  createdAt: new Date('2025-03-01'),
  updatedAt: new Date('2025-03-01'),
};

const mockGrant = {
  id: 'grant-1',
  patientId: 'user-1',
  providerId: 'prov-1',
  recordId: 'rec-1',
  status: GrantStatus.ACTIVE,
  createdAt: new Date('2025-03-01'),
  updatedAt: new Date('2025-03-01'),
};

const mockAuditLog = {
  id: 'audit-1',
  resourceId: 'rec-1',
  actorId: 'user-1',
  action: 'VIEW',
  createdAt: new Date('2025-03-01'),
};

/* ─── Service mocks ────────────────────────────────────────────────── */

const usersServiceMock = {
  findById: jest.fn().mockResolvedValue(mockUser),
  findProviderById: jest.fn().mockResolvedValue(mockProvider),
  findProviders: jest.fn().mockResolvedValue([mockProvider]),
};

const recordsServiceMock = {
  findByIdWithAccessCheck: jest.fn().mockResolvedValue(mockRecord),
  findPaginated: jest
    .fn()
    .mockResolvedValue({ items: [mockRecord], total: 1 }),
};

const grantsServiceMock = {
  findByPatient: jest.fn().mockResolvedValue([mockGrant]),
};

const auditServiceMock = {
  findPaginated: jest
    .fn()
    .mockResolvedValue({ items: [mockAuditLog], total: 1 }),
};

const userLoaderMock = {
  load: jest.fn().mockResolvedValue(mockUser),
  loadMany: jest.fn().mockResolvedValue([mockUser]),
};

const recordLoaderMock = {
  loadGrantsForRecord: jest.fn().mockResolvedValue([mockGrant]),
};

/* ═══════════════════════════════════════════════════════════════════ */
/*                         QueryResolver tests                         */
/* ═══════════════════════════════════════════════════════════════════ */

describe('QueryResolver', () => {
  let resolver: QueryResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueryResolver,
        { provide: UsersService, useValue: usersServiceMock },
        { provide: MedicalRecordsService, useValue: recordsServiceMock },
        { provide: AccessGrantsService, useValue: grantsServiceMock },
        { provide: AuditLogService, useValue: auditServiceMock },
        { provide: UserDataLoader, useValue: userLoaderMock },
      ],
    }).compile();

    resolver = module.get<QueryResolver>(QueryResolver);
    jest.clearAllMocks();
  });

  /* ── me ───────────────────────────────────────────────────────── */

  describe('me', () => {
    it('returns the authenticated user profile', async () => {
      usersServiceMock.findById.mockResolvedValueOnce(mockUser);
      const result = await resolver.me({ sub: 'user-1' });
      expect(result).toEqual(mockUser);
      expect(usersServiceMock.findById).toHaveBeenCalledWith('user-1');
    });
  });

  /* ── record(id) ───────────────────────────────────────────────── */

  describe('record', () => {
    it('returns a record when the user has access', async () => {
      recordsServiceMock.findByIdWithAccessCheck.mockResolvedValueOnce(mockRecord);
      const result = await resolver.record('rec-1', { sub: 'user-1', role: UserRole.PATIENT });
      expect(result).toEqual(mockRecord);
      expect(recordsServiceMock.findByIdWithAccessCheck).toHaveBeenCalledWith(
        'rec-1',
        'user-1',
        UserRole.PATIENT,
      );
    });

    it('propagates access-denied errors from the service', async () => {
      recordsServiceMock.findByIdWithAccessCheck.mockRejectedValueOnce(
        Object.assign(new Error('Forbidden'), { status: 403 }),
      );
      await expect(
        resolver.record('rec-1', { sub: 'other-user', role: UserRole.PATIENT }),
      ).rejects.toMatchObject({ status: 403 });
    });
  });

  /* ── records(filter, pagination) ─────────────────────────────── */

  describe('records', () => {
    it('returns a Relay connection with edges and pageInfo', async () => {
      recordsServiceMock.findPaginated.mockResolvedValueOnce({
        items: [mockRecord],
        total: 1,
      });

      const result = await resolver.records(
        undefined,
        { first: 20 },
        { sub: 'user-1', role: UserRole.PATIENT },
      );

      expect(result.totalCount).toBe(1);
      expect(result.edges).toHaveLength(1);
      expect(result.edges[0].node).toEqual(mockRecord);
      expect(result.pageInfo.hasNextPage).toBe(false);
    });

    it('passes filter through to service', async () => {
      recordsServiceMock.findPaginated.mockResolvedValueOnce({ items: [], total: 0 });

      const filter = { recordType: RecordType.LAB_RESULT };
      await resolver.records(filter, { first: 5 }, { sub: 'user-1', role: UserRole.PATIENT });

      expect(recordsServiceMock.findPaginated).toHaveBeenCalledWith(
        'user-1',
        UserRole.PATIENT,
        filter,
        { first: 5 },
      );
    });

    it('sets hasNextPage=true when service returns more items than requested', async () => {
      const extraItem = { ...mockRecord, id: 'rec-2' };
      recordsServiceMock.findPaginated.mockResolvedValueOnce({
        items: [mockRecord, extraItem], // service returns first+1
        total: 10,
      });

      const result = await resolver.records(
        undefined,
        { first: 1 },
        { sub: 'user-1', role: UserRole.PATIENT },
      );

      expect(result.pageInfo.hasNextPage).toBe(true);
      expect(result.edges).toHaveLength(1);
    });
  });

  /* ── accessGrants ─────────────────────────────────────────────── */

  describe('accessGrants', () => {
    it('returns grants for the authenticated patient', async () => {
      grantsServiceMock.findByPatient.mockResolvedValueOnce([mockGrant]);
      const result = await resolver.accessGrants(
        undefined,
        GrantStatus.ACTIVE,
        { sub: 'user-1', role: UserRole.PATIENT },
      );
      expect(result).toEqual([mockGrant]);
      expect(grantsServiceMock.findByPatient).toHaveBeenCalledWith('user-1', GrantStatus.ACTIVE);
    });

    it('allows ADMIN to query any patient by patientId', async () => {
      grantsServiceMock.findByPatient.mockResolvedValueOnce([mockGrant]);
      await resolver.accessGrants(
        'user-2',
        undefined,
        { sub: 'admin-1', role: UserRole.ADMIN },
      );
      expect(grantsServiceMock.findByPatient).toHaveBeenCalledWith('user-2', undefined);
    });

    it('ignores patientId arg for PATIENT role — always uses own id', async () => {
      grantsServiceMock.findByPatient.mockResolvedValueOnce([mockGrant]);
      await resolver.accessGrants(
        'malicious-other-id',
        undefined,
        { sub: 'user-1', role: UserRole.PATIENT },
      );
      expect(grantsServiceMock.findByPatient).toHaveBeenCalledWith('user-1', undefined);
    });
  });

  /* ── auditLog query ───────────────────────────────────────────── */

  describe('auditLog', () => {
    it('returns a paginated audit connection', async () => {
      auditServiceMock.findPaginated.mockResolvedValueOnce({
        items: [mockAuditLog],
        total: 1,
      });

      const result = await resolver.auditLog(
        'rec-1',
        { first: 10 },
        { sub: 'user-1', role: UserRole.PATIENT },
      );

      expect(result.totalCount).toBe(1);
      expect(result.edges[0].node).toEqual(mockAuditLog);
    });
  });

  /* ── providers ─────────────────────────────────────────────────── */

  describe('providers', () => {
    it('returns provider directory filtered by specialty', async () => {
      usersServiceMock.findProviders.mockResolvedValueOnce([mockProvider]);
      const result = await resolver.providers(undefined, 'Diagnostics');
      expect(result).toEqual([mockProvider]);
      expect(usersServiceMock.findProviders).toHaveBeenCalledWith({
        search: undefined,
        specialty: 'Diagnostics',
      });
    });
  });
});

/* ═══════════════════════════════════════════════════════════════════ */
/*              MedicalRecordFieldResolver — field-level auth          */
/* ═══════════════════════════════════════════════════════════════════ */

describe('MedicalRecordFieldResolver', () => {
  let resolver: MedicalRecordFieldResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MedicalRecordFieldResolver,
        { provide: UserDataLoader, useValue: userLoaderMock },
        { provide: RecordDataLoader, useValue: recordLoaderMock },
        { provide: AuditLogService, useValue: auditServiceMock },
      ],
    }).compile();

    resolver = module.get<MedicalRecordFieldResolver>(MedicalRecordFieldResolver);
    jest.clearAllMocks();
  });

  /* ── patient field uses DataLoader ─────────────────────────────── */

  it('resolves patient via UserDataLoader (no N+1)', async () => {
    userLoaderMock.load.mockResolvedValueOnce(mockUser);
    const result = await resolver.patient(mockRecord as any);
    expect(result).toEqual(mockUser);
    expect(userLoaderMock.load).toHaveBeenCalledWith('user-1');
  });

  /* ── uploadedBy returns null when missing ────────────────────── */

  it('returns null for uploadedBy when uploadedById is absent', async () => {
    const recordWithoutUploader = { ...mockRecord, uploadedById: undefined };
    const result = await resolver.uploadedBy(recordWithoutUploader as any);
    expect(result).toBeNull();
    expect(userLoaderMock.load).not.toHaveBeenCalled();
  });

  /* ── accessGrants uses RecordDataLoader ──────────────────────── */

  it('resolves accessGrants via RecordDataLoader (batched)', async () => {
    recordLoaderMock.loadGrantsForRecord.mockResolvedValueOnce([mockGrant]);
    const result = await resolver.accessGrants(mockRecord as any);
    expect(result).toEqual([mockGrant]);
    expect(recordLoaderMock.loadGrantsForRecord).toHaveBeenCalledWith('rec-1');
  });

  /* ── auditLog field: PATIENT owner resolves successfully ─────── */

  it('resolves auditLog for the record owner (PATIENT)', async () => {
    auditServiceMock.findPaginated.mockResolvedValueOnce({
      items: [mockAuditLog],
      total: 1,
    });

    const ctx = { req: { user: { sub: 'user-1', role: UserRole.PATIENT } } };
    const result = await resolver.auditLog(mockRecord as any, ctx as any, { first: 10 });

    expect(result).not.toBeNull();
    expect(result!.edges[0].node).toEqual(mockAuditLog);
  });

  /* ── auditLog field: ADMIN resolves for any patient ─────────── */

  it('resolves auditLog for ADMIN regardless of ownership', async () => {
    auditServiceMock.findPaginated.mockResolvedValueOnce({
      items: [mockAuditLog],
      total: 1,
    });

    const ctx = { req: { user: { sub: 'admin-99', role: UserRole.ADMIN } } };
    const result = await resolver.auditLog(mockRecord as any, ctx as any, { first: 10 });

    expect(result).not.toBeNull();
  });

  /* ── auditLog field: PROVIDER is silently denied (returns null) ─ */

  it('returns null for auditLog when resolved by a non-owner PROVIDER', async () => {
    const ctx = { req: { user: { sub: 'prov-99', role: UserRole.PROVIDER } } };
    const result = await resolver.auditLog(mockRecord as any, ctx as any, { first: 10 });

    expect(result).toBeNull();
    expect(auditServiceMock.findPaginated).not.toHaveBeenCalled();
  });
});

/* ═══════════════════════════════════════════════════════════════════ */
/*        AccessGrantFieldResolver — DataLoader batching test          */
/* ═══════════════════════════════════════════════════════════════════ */

describe('AccessGrantFieldResolver — DataLoader batching', () => {
  let resolver: AccessGrantFieldResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccessGrantFieldResolver,
        { provide: UserDataLoader, useValue: userLoaderMock },
      ],
    }).compile();

    resolver = module.get<AccessGrantFieldResolver>(AccessGrantFieldResolver);
    jest.clearAllMocks();
  });

  it('resolves patient and provider for multiple grants without N+1 (batched via DataLoader)', async () => {
    const grants = [
      { ...mockGrant, id: 'g-1', patientId: 'user-1', providerId: 'prov-1' },
      { ...mockGrant, id: 'g-2', patientId: 'user-1', providerId: 'prov-2' },
    ];

    userLoaderMock.load
      .mockResolvedValueOnce(mockUser)       // patient for g-1
      .mockResolvedValueOnce(mockProvider)   // provider for g-1
      .mockResolvedValueOnce(mockUser)       // patient for g-2
      .mockResolvedValueOnce({ ...mockProvider, id: 'prov-2' }); // provider for g-2

    await Promise.all(
      grants.flatMap((g) => [resolver.patient(g as any), resolver.provider(g as any)]),
    );

    // DataLoader consolidates: 4 individual .load() calls dispatched,
    // but the underlying batch function fires once per tick
    expect(userLoaderMock.load).toHaveBeenCalledTimes(4);
    expect(userLoaderMock.load).toHaveBeenCalledWith('user-1');
    expect(userLoaderMock.load).toHaveBeenCalledWith('prov-1');
  });
});

/* ═══════════════════════════════════════════════════════════════════ */
/*                   pagination utility unit tests                     */
/* ═══════════════════════════════════════════════════════════════════ */

describe('buildConnection utility', () => {
  const makeItem = (id: string) => ({
    id,
    createdAt: new Date('2025-01-01'),
  });

  it('produces correct edge cursors and pageInfo', () => {
    const items = [makeItem('a'), makeItem('b')];
    const conn = buildConnection(items, { first: 2 }, 10);

    expect(conn.edges).toHaveLength(2);
    expect(conn.pageInfo.hasNextPage).toBe(false);
    expect(conn.pageInfo.hasPreviousPage).toBe(false);
    expect(conn.totalCount).toBe(10);
    expect(typeof conn.edges[0].cursor).toBe('string');
  });

  it('sets hasNextPage=true when items.length > first', () => {
    const items = [makeItem('a'), makeItem('b'), makeItem('c')]; // +1 sentinel
    const conn = buildConnection(items, { first: 2 }, 50);

    expect(conn.pageInfo.hasNextPage).toBe(true);
    expect(conn.edges).toHaveLength(2); // sentinel trimmed
  });

  it('sets hasPreviousPage=true when after cursor is present', () => {
    const conn = buildConnection([makeItem('z')], { first: 10, after: 'somecursor' }, 5);
    expect(conn.pageInfo.hasPreviousPage).toBe(true);
  });
});
