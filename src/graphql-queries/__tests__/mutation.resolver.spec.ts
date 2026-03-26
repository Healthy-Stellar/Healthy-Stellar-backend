import { Test, TestingModule } from '@nestjs/testing';
import { MutationResolver } from '../resolvers/mutation.resolver';
import { MedicalRecordsService } from '../../records/services/medical-records.service';
import { AccessGrantsService } from '../../records/services/access-grants.service';
import { UsersService } from '../../users/users.service';
import { GdprService } from '../../gdpr/gdpr.service';
import { DevicesService } from '../../devices/devices.service';
import { IdempotencyService } from '../services/idempotency.service';
import {
  UploadRecordSuccess,
  AccessGrantSuccess,
  RevokeAccessSuccess,
  UpdateProfileSuccess,
  RegisterDeviceSuccess,
  GdprRequestSuccess,
  ValidationError,
  UnauthorizedError,
  StellarTransactionError,
  NotFoundError,
} from '../types/payload.types';
import { GdprRequestType, JobStatus, RecordType, UserRole, GrantStatus } from '../enums';

/* ─── Stubs ──────────────────────────────────────────────────────── */

const mockRecordEntity = {
  id: 'rec-1',
  title: 'Blood Panel',
  recordType: RecordType.LAB_RESULT,
  patientId: 'user-1',
  fileUrl: 'https://cdn.example.com/rec-1.pdf',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockGrant = {
  id: 'grant-1',
  patientId: 'user-1',
  providerId: 'prov-1',
  recordId: 'rec-1',
  status: GrantStatus.ACTIVE,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockUserEntity = {
  id: 'user-1',
  email: 'ada@example.com',
  firstName: 'Ada',
  lastName: 'Lovelace',
  role: UserRole.PATIENT,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockUploadStream = () => ({
  filename: 'report.pdf',
  mimetype: 'application/pdf',
  createReadStream: jest.fn().mockReturnValue({ pipe: jest.fn() }),
});

/* ─── Service mocks ──────────────────────────────────────────────── */

const recordsServiceMock = {
  upload: jest.fn().mockResolvedValue({
    record: mockRecordEntity,
    jobId: 'job-abc',
    estimatedCompletionTime: new Date(Date.now() + 60_000),
  }),
};

const grantsServiceMock = {
  grant: jest.fn().mockResolvedValue(mockGrant),
  revoke: jest.fn().mockResolvedValue(undefined),
};

const usersServiceMock = {
  updateProfile: jest.fn().mockResolvedValue(mockUserEntity),
  uploadAvatar: jest.fn().mockResolvedValue('https://cdn.example.com/avatar.jpg'),
};

const gdprServiceMock = {
  submitRequest: jest.fn().mockResolvedValue({
    jobId: 'gdpr-job-1',
    estimatedCompletionTime: new Date(Date.now() + 3_600_000),
  }),
};

const devicesServiceMock = {
  register: jest.fn().mockResolvedValue({ id: 'device-1' }),
};

const idempotencyServiceMock = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
};

/* ─── Auth user fixtures ─────────────────────────────────────────── */

const patientUser = { sub: 'user-1', role: UserRole.PATIENT };
const adminUser = { sub: 'admin-1', role: UserRole.ADMIN };
const providerUser = { sub: 'prov-1', role: UserRole.PROVIDER };

/* ═══════════════════════════════════════════════════════════════════ */
/*                       MutationResolver tests                        */
/* ═══════════════════════════════════════════════════════════════════ */

describe('MutationResolver', () => {
  let resolver: MutationResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MutationResolver,
        { provide: MedicalRecordsService, useValue: recordsServiceMock },
        { provide: AccessGrantsService, useValue: grantsServiceMock },
        { provide: UsersService, useValue: usersServiceMock },
        { provide: GdprService, useValue: gdprServiceMock },
        { provide: DevicesService, useValue: devicesServiceMock },
        { provide: IdempotencyService, useValue: idempotencyServiceMock },
      ],
    }).compile();

    resolver = module.get<MutationResolver>(MutationResolver);
    jest.clearAllMocks();
  });

  /* ═══════════════════════════════════════════════════════════════ */
  /*                          uploadRecord                           */
  /* ═══════════════════════════════════════════════════════════════ */

  describe('uploadRecord', () => {
    const baseInput = {
      file: Promise.resolve(mockUploadStream()),
      recordType: RecordType.LAB_RESULT,
      title: 'Blood Panel Q1',
    };

    it('SUCCESS — returns UploadRecordSuccess with jobId and QUEUED status', async () => {
      const result = await resolver.uploadRecord(baseInput as any, patientUser);

      expect(result).toMatchObject({
        record: mockRecordEntity,
        jobId: 'job-abc',
        status: JobStatus.QUEUED,
        idempotent: false,
      });
      expect(recordsServiceMock.upload).toHaveBeenCalledTimes(1);
    });

    it('IDEMPOTENCY — returns cached result on duplicate idempotencyKey', async () => {
      const cachedResult = { record: mockRecordEntity, idempotent: false };
      idempotencyServiceMock.get.mockResolvedValueOnce(cachedResult);

      const input = { ...baseInput, idempotencyKey: 'idem-key-123' };
      const result = await resolver.uploadRecord(input as any, patientUser);

      expect((result as UploadRecordSuccess).idempotent).toBe(true);
      expect(recordsServiceMock.upload).not.toHaveBeenCalled();
    });

    it('IDEMPOTENCY — stores result in cache on first call', async () => {
      idempotencyServiceMock.get.mockResolvedValueOnce(null);

      const input = { ...baseInput, idempotencyKey: 'fresh-key' };
      await resolver.uploadRecord(input as any, patientUser);

      expect(idempotencyServiceMock.set).toHaveBeenCalledWith(
        'upload:user-1:fresh-key',
        expect.objectContaining({ jobId: 'job-abc' }),
      );
    });

    it('STELLAR ERROR — returns StellarTransactionError on chain failure', async () => {
      recordsServiceMock.upload.mockRejectedValueOnce(
        Object.assign(new Error('Ledger closed'), {
          name: 'StellarError',
          txHash: 'abc123',
          code: 'LEDGER_CLOSED',
        }),
      );

      const result = await resolver.uploadRecord(baseInput as any, patientUser);

      expect(result).toMatchObject({
        message: 'Ledger closed',
        txHash: 'abc123',
        errorCode: 'LEDGER_CLOSED',
      } as StellarTransactionError);
    });

    it('VALIDATION ERROR — returns ValidationError on invalid input', async () => {
      recordsServiceMock.upload.mockRejectedValueOnce(
        Object.assign(new Error('File too large'), {
          name: 'ValidationError',
          fieldErrors: [{ field: 'file', message: 'Max 50MB allowed' }],
        }),
      );

      const result = await resolver.uploadRecord(baseInput as any, patientUser);
      expect((result as ValidationError).fieldErrors).toHaveLength(1);
      expect((result as ValidationError).fieldErrors![0].field).toBe('file');
    });

    it('UNAUTHORIZED — returns UnauthorizedError when status 403', async () => {
      recordsServiceMock.upload.mockRejectedValueOnce(
        Object.assign(new Error('Not your record'), { status: 403 }),
      );

      const result = await resolver.uploadRecord(baseInput as any, providerUser);
      expect((result as UnauthorizedError).message).toBe('Not your record');
    });

    it('re-throws unknown errors (non-domain exceptions)', async () => {
      recordsServiceMock.upload.mockRejectedValueOnce(new Error('DB down'));
      await expect(resolver.uploadRecord(baseInput as any, patientUser)).rejects.toThrow('DB down');
    });
  });

  /* ═══════════════════════════════════════════════════════════════ */
  /*                          grantAccess                            */
  /* ═══════════════════════════════════════════════════════════════ */

  describe('grantAccess', () => {
    const input = { recordId: 'rec-1', providerId: 'prov-1' };

    it('SUCCESS — returns AccessGrantSuccess with the created grant', async () => {
      grantsServiceMock.grant.mockResolvedValueOnce(mockGrant);
      const result = await resolver.grantAccess(input as any, patientUser);

      expect((result as AccessGrantSuccess).grant).toEqual(mockGrant);
      expect(grantsServiceMock.grant).toHaveBeenCalledWith(
        'rec-1',
        'prov-1',
        'user-1',
        undefined,
      );
    });

    it('NOT FOUND — returns NotFoundError when record does not exist', async () => {
      grantsServiceMock.grant.mockRejectedValueOnce(
        Object.assign(new Error('Record not found'), { status: 404 }),
      );

      const result = await resolver.grantAccess(input as any, patientUser);
      expect(result).toMatchObject({ message: 'Record not found' } as NotFoundError);
    });

    it('UNAUTHORIZED — returns UnauthorizedError when not the record owner', async () => {
      grantsServiceMock.grant.mockRejectedValueOnce(
        Object.assign(new Error('You do not own this record'), { status: 403 }),
      );

      const result = await resolver.grantAccess(input as any, patientUser);
      expect((result as UnauthorizedError).message).toContain('do not own');
    });

    it('VALIDATION — returns ValidationError on bad grant input', async () => {
      grantsServiceMock.grant.mockRejectedValueOnce(
        Object.assign(new Error('Invalid expiresAt'), {
          name: 'ValidationError',
          fieldErrors: [{ field: 'expiresAt', message: 'Must be in the future' }],
        }),
      );

      const result = await resolver.grantAccess(input as any, patientUser);
      expect((result as ValidationError).fieldErrors![0].field).toBe('expiresAt');
    });
  });

  /* ═══════════════════════════════════════════════════════════════ */
  /*                         revokeAccess                            */
  /* ═══════════════════════════════════════════════════════════════ */

  describe('revokeAccess', () => {
    it('SUCCESS — returns grantId and revoked:true', async () => {
      grantsServiceMock.revoke.mockResolvedValueOnce(undefined);
      const result = await resolver.revokeAccess('grant-1', patientUser);

      expect(result).toMatchObject({ grantId: 'grant-1', revoked: true } as RevokeAccessSuccess);
      expect(grantsServiceMock.revoke).toHaveBeenCalledWith('grant-1', 'user-1', UserRole.PATIENT);
    });

    it('NOT FOUND — returns NotFoundError when grant does not exist', async () => {
      grantsServiceMock.revoke.mockRejectedValueOnce(
        Object.assign(new Error('Grant not found'), { status: 404 }),
      );

      const result = await resolver.revokeAccess('ghost-id', patientUser);
      expect(result).toMatchObject({ message: 'Grant not found' } as NotFoundError);
    });

    it('UNAUTHORIZED — returns UnauthorizedError for a provider trying to revoke', async () => {
      grantsServiceMock.revoke.mockRejectedValueOnce(
        Object.assign(new Error('Cannot revoke'), { status: 403 }),
      );

      const result = await resolver.revokeAccess('grant-1', providerUser);
      expect((result as UnauthorizedError).message).toBe('Cannot revoke');
    });
  });

  /* ═══════════════════════════════════════════════════════════════ */
  /*                         updateProfile                           */
  /* ═══════════════════════════════════════════════════════════════ */

  describe('updateProfile', () => {
    it('SUCCESS — returns updated User without avatar upload', async () => {
      usersServiceMock.updateProfile.mockResolvedValueOnce(mockUserEntity);
      const input = { firstName: 'Ada', lastName: 'Byron' };

      const result = await resolver.updateProfile(input as any, patientUser);
      expect((result as UpdateProfileSuccess).user).toEqual(mockUserEntity);
      expect(usersServiceMock.uploadAvatar).not.toHaveBeenCalled();
    });

    it('SUCCESS — uploads avatar and includes URL in profile update', async () => {
      usersServiceMock.uploadAvatar.mockResolvedValueOnce('https://cdn.example.com/new-avatar.png');
      usersServiceMock.updateProfile.mockResolvedValueOnce({
        ...mockUserEntity,
        avatarUrl: 'https://cdn.example.com/new-avatar.png',
      });

      const input = {
        firstName: 'Ada',
        avatar: Promise.resolve({
          filename: 'photo.png',
          mimetype: 'image/png',
          createReadStream: jest.fn().mockReturnValue({}),
        }),
      };

      const result = await resolver.updateProfile(input as any, patientUser);
      expect(usersServiceMock.uploadAvatar).toHaveBeenCalled();
      expect((result as UpdateProfileSuccess).user.avatarUrl).toContain('new-avatar');
    });

    it('VALIDATION — returns ValidationError on bad phone number', async () => {
      usersServiceMock.updateProfile.mockRejectedValueOnce(
        Object.assign(new Error('Invalid phone'), {
          name: 'ValidationError',
          fieldErrors: [{ field: 'phoneNumber', message: 'Invalid format' }],
        }),
      );

      const result = await resolver.updateProfile({ phoneNumber: 'bad' } as any, patientUser);
      expect((result as ValidationError).fieldErrors![0].field).toBe('phoneNumber');
    });

    it('UNAUTHORIZED — returns UnauthorizedError on forbidden update', async () => {
      usersServiceMock.updateProfile.mockRejectedValueOnce(
        Object.assign(new Error('Cannot edit this profile'), { status: 403 }),
      );

      const result = await resolver.updateProfile({} as any, providerUser);
      expect((result as UnauthorizedError).message).toContain('Cannot edit');
    });
  });

  /* ═══════════════════════════════════════════════════════════════ */
  /*                        registerDevice                           */
  /* ═══════════════════════════════════════════════════════════════ */

  describe('registerDevice', () => {
    const input = { pushToken: 'fcm-abc', platform: 'android', deviceModel: 'Pixel 9' };

    it('SUCCESS — returns deviceId and registered:true', async () => {
      devicesServiceMock.register.mockResolvedValueOnce({ id: 'device-xyz' });
      const result = await resolver.registerDevice(input as any, patientUser);

      expect((result as RegisterDeviceSuccess).deviceId).toBe('device-xyz');
      expect((result as RegisterDeviceSuccess).registered).toBe(true);
    });

    it('VALIDATION — returns ValidationError on missing pushToken', async () => {
      devicesServiceMock.register.mockRejectedValueOnce(
        Object.assign(new Error('pushToken is required'), {
          name: 'ValidationError',
          fieldErrors: [{ field: 'pushToken', message: 'should not be empty' }],
        }),
      );

      const result = await resolver.registerDevice({} as any, patientUser);
      expect((result as ValidationError).fieldErrors![0].field).toBe('pushToken');
    });

    it('UNAUTHORIZED — returns UnauthorizedError on forbidden device registration', async () => {
      devicesServiceMock.register.mockRejectedValueOnce(
        Object.assign(new Error('Token expired'), { status: 403 }),
      );

      const result = await resolver.registerDevice(input as any, patientUser);
      expect((result as UnauthorizedError).message).toBe('Token expired');
    });
  });

  /* ═══════════════════════════════════════════════════════════════ */
  /*                       submitGdprRequest                         */
  /* ═══════════════════════════════════════════════════════════════ */

  describe('submitGdprRequest', () => {
    it('SUCCESS — returns jobId with QUEUED status', async () => {
      gdprServiceMock.submitRequest.mockResolvedValueOnce({
        jobId: 'gdpr-1',
        estimatedCompletionTime: new Date(),
      });

      const result = await resolver.submitGdprRequest(GdprRequestType.ACCESS, patientUser);

      expect((result as GdprRequestSuccess).jobId).toBe('gdpr-1');
      expect((result as GdprRequestSuccess).status).toBe(JobStatus.QUEUED);
      expect(gdprServiceMock.submitRequest).toHaveBeenCalledWith('user-1', GdprRequestType.ACCESS);
    });

    it('SUCCESS — ERASURE request also returns async job', async () => {
      gdprServiceMock.submitRequest.mockResolvedValueOnce({
        jobId: 'gdpr-erase-1',
        estimatedCompletionTime: new Date(Date.now() + 86_400_000),
      });

      const result = await resolver.submitGdprRequest(GdprRequestType.ERASURE, patientUser);
      expect((result as GdprRequestSuccess).status).toBe(JobStatus.QUEUED);
    });

    it('UNAUTHORIZED — returns UnauthorizedError when role is insufficient', async () => {
      gdprServiceMock.submitRequest.mockRejectedValueOnce(
        Object.assign(new Error('Providers cannot submit GDPR requests'), { status: 403 }),
      );

      const result = await resolver.submitGdprRequest(GdprRequestType.PORTABILITY, providerUser);
      expect((result as UnauthorizedError).message).toContain('Providers cannot');
    });

    it('VALIDATION — returns ValidationError for duplicate pending request', async () => {
      gdprServiceMock.submitRequest.mockRejectedValueOnce(
        Object.assign(new Error('A pending request already exists'), {
          name: 'ValidationError',
          fieldErrors: [{ field: 'type', message: 'Duplicate pending request' }],
        }),
      );

      const result = await resolver.submitGdprRequest(GdprRequestType.ACCESS, patientUser);
      expect((result as ValidationError).fieldErrors![0].message).toContain('Duplicate');
    });
  });
});
