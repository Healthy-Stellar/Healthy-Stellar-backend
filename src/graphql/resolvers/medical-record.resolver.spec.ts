import { Test } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { MedicalRecordResolver } from './medical-record.resolver';
import { DataloaderService } from '../dataloader.service';
import { GqlAuthGuard } from '../guards/gql-auth.guard';
import { TenantContext } from '../../tenant/context/tenant.context';
import { GqlMedicalRecordStatus, GqlRecordType } from '../types/medical-record.type';

const mockRecord = {
  id: 'rec-1',
  patientId: 'pat-1',
  recordType: GqlGqlRecordType.CONSULTATION,
  status: GqlMedicalRecordStatus.ACTIVE,
  title: 'Consultation',
  description: 'Test consultation',
  stellarTxHash: 'tx-hash-123',
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: 'user-1',
};

const mockMedicalRecordsService = {
  findOne: jest.fn().mockResolvedValue(mockRecord),
  search: jest.fn().mockResolvedValue({ data: [mockRecord], total: 1 }),
  create: jest.fn().mockResolvedValue(mockRecord),
};

const mockDataloaderService = {};

describe('MedicalRecordResolver', () => {
  let resolver: MedicalRecordResolver;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        MedicalRecordResolver,
        { provide: 'MedicalRecordsService', useValue: mockMedicalRecordsService },
        { provide: DataloaderService, useValue: mockDataloaderService },
      ],
    })
      .overrideGuard(GqlAuthGuard)
      .useValue({ canActivate: (_ctx: ExecutionContext) => true })
      .compile();
    resolver = module.get(MedicalRecordResolver);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('record query', () => {
    it('should return a record when found', async () => {
      jest.spyOn(TenantContext, 'getTenantId').mockReturnValue('org-1');

      const result = await resolver.record('rec-1', { req: { user: { sub: 'user-1' } } } as any);

      expect(result).toEqual({
        id: 'rec-1',
        patientId: 'pat-1',
        recordType: GqlGqlRecordType.CONSULTATION,
        status: GqlMedicalRecordStatus.ACTIVE,
        title: 'Consultation',
        description: 'Test consultation',
        stellarTxHash: 'tx-hash-123',
        createdAt: mockRecord.createdAt,
        updatedAt: mockRecord.updatedAt,
        uploadedBy: 'user-1',
      });
      expect(mockMedicalRecordsService.findOne).toHaveBeenCalledWith('rec-1', undefined, 'org-1');
    });

    it('should throw ForbiddenException when tenant context is not found', async () => {
      jest.spyOn(TenantContext, 'getTenantId').mockReturnValue(undefined);

      await expect(resolver.record('rec-1', { req: { user: { sub: 'user-1' } } } as any)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should return null when record not found', async () => {
      jest.spyOn(TenantContext, 'getTenantId').mockReturnValue('org-1');
      mockMedicalRecordsService.findOne.mockRejectedValueOnce(new Error('Not found'));

      const result = await resolver.record('rec-1', { req: { user: { sub: 'user-1' } } } as any);

      expect(result).toBeNull();
    });
  });

  describe('records query', () => {
    it('should return records by patient', async () => {
      jest.spyOn(TenantContext, 'getTenantId').mockReturnValue('org-1');

      const result = await resolver.records('pat-1', { req: { user: { sub: 'user-1' } } } as any);

      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toEqual({
        id: 'rec-1',
        patientId: 'pat-1',
        recordType: GqlGqlRecordType.CONSULTATION,
        status: GqlMedicalRecordStatus.ACTIVE,
        title: 'Consultation',
        description: 'Test consultation',
        stellarTxHash: 'tx-hash-123',
        createdAt: mockRecord.createdAt,
        updatedAt: mockRecord.updatedAt,
        uploadedBy: 'user-1',
      });
      expect(mockMedicalRecordsService.search).toHaveBeenCalledWith(
        { patientId: 'pat-1', limit: 100, page: 1 },
        'org-1',
      );
    });

    it('should throw ForbiddenException when tenant context is not found', async () => {
      jest.spyOn(TenantContext, 'getTenantId').mockReturnValue(undefined);

      await expect(resolver.records('pat-1', { req: { user: { sub: 'user-1' } } } as any)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('addRecord mutation', () => {
    it('should create a new record', async () => {
      jest.spyOn(TenantContext, 'getTenantId').mockReturnValue('org-1');

      const input = {
        patientId: 'pat-1',
        recordType: GqlRecordType.CONSULTATION,
        description: 'Test consultation',
      };

      const result = await resolver.addRecord(input as any, { req: { user: { sub: 'user-1' } } } as any);

      expect(result).toEqual({
        id: 'rec-1',
        patientId: 'pat-1',
        recordType: GqlGqlRecordType.CONSULTATION,
        status: GqlMedicalRecordStatus.ACTIVE,
        title: 'Consultation',
        description: 'Test consultation',
        stellarTxHash: 'tx-hash-123',
        createdAt: mockRecord.createdAt,
        updatedAt: mockRecord.updatedAt,
        uploadedBy: 'user-1',
      });
      expect(mockMedicalRecordsService.create).toHaveBeenCalledWith(
        {
          patientId: 'pat-1',
          recordType: GqlRecordType.CONSULTATION,
          description: 'Test consultation',
        },
        'user-1',
        'user-1',
        'org-1',
      );
    });

    it('should throw ForbiddenException when tenant context is not found', async () => {
      jest.spyOn(TenantContext, 'getTenantId').mockReturnValue(undefined);

      const input = {
        patientId: 'pat-1',
        recordType: GqlRecordType.CONSULTATION,
        description: 'Test consultation',
      };

      await expect(resolver.addRecord(input as any, { req: { user: { sub: 'user-1' } } } as any)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('calls the correct service method and returns its result', async () => {
      jest.spyOn(TenantContext, 'getTenantId').mockReturnValue('org-1');

      const input = {
        patientId: 'pat-1',
        recordType: GqlRecordType.CONSULTATION,
        description: 'Test',
      };

      const result = await resolver.addRecord(input as any, { req: { user: { sub: 'user-1' } } } as any);

      expect(mockMedicalRecordsService.create).toHaveBeenCalled();
      expect(result).toBeTruthy();
    });
  });
});
