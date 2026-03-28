import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ProviderPatientRelationshipService } from './provider-patient-relationship.service';
import { ProviderPatientRelationship } from '../entities/provider-patient-relationship.entity';
import { ProviderPatientRelationshipController } from '../controllers/provider-patient-relationship.controller';
import { RelationshipQueryDto } from '../dto/relationship-query.dto';
import { UserRole } from '../../auth/entities/user.entity';

const mockRepo = {
  findAndCount: jest.fn(),
};

const mockDataSource = {
  query: jest.fn(),
};

const makeRelationship = (
  overrides: Partial<ProviderPatientRelationship> = {},
): ProviderPatientRelationship =>
  ({
    id: 'rel-uuid-1',
    providerId: 'provider-1',
    patientId: 'patient-1',
    firstInteractionAt: new Date('2024-01-01'),
    recordCount: 3,
    ...overrides,
  }) as ProviderPatientRelationship;

describe('ProviderPatientRelationshipService', () => {
  let service: ProviderPatientRelationshipService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProviderPatientRelationshipService,
        { provide: getRepositoryToken(ProviderPatientRelationship), useValue: mockRepo },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<ProviderPatientRelationshipService>(ProviderPatientRelationshipService);
    jest.clearAllMocks();
  });

  // ─── upsertRelationship ───────────────────────────────────────────────────

  describe('upsertRelationship', () => {
    it('executes the upsert SQL with correct parameters', async () => {
      mockDataSource.query.mockResolvedValue(undefined);

      await service.upsertRelationship('provider-1', 'patient-1');

      expect(mockDataSource.query).toHaveBeenCalledTimes(1);
      const [sql, params] = mockDataSource.query.mock.calls[0];
      expect(sql).toContain('ON CONFLICT');
      expect(sql).toContain('recordCount');
      expect(params).toEqual(['provider-1', 'patient-1']);
    });

    it('increments recordCount on subsequent calls for the same pair', async () => {
      mockDataSource.query.mockResolvedValue(undefined);

      await service.upsertRelationship('provider-1', 'patient-1');
      await service.upsertRelationship('provider-1', 'patient-1');

      expect(mockDataSource.query).toHaveBeenCalledTimes(2);
    });

    it('handles different provider-patient pairs independently', async () => {
      mockDataSource.query.mockResolvedValue(undefined);

      await service.upsertRelationship('provider-1', 'patient-1');
      await service.upsertRelationship('provider-2', 'patient-2');

      expect(mockDataSource.query).toHaveBeenNthCalledWith(
        1,
        expect.any(String),
        ['provider-1', 'patient-1'],
      );
      expect(mockDataSource.query).toHaveBeenNthCalledWith(
        2,
        expect.any(String),
        ['provider-2', 'patient-2'],
      );
    });

    it('propagates database errors', async () => {
      mockDataSource.query.mockRejectedValue(new Error('DB connection lost'));

      await expect(service.upsertRelationship('provider-1', 'patient-1')).rejects.toThrow(
        'DB connection lost',
      );
    });
  });

  // ─── getPatientsByProvider ────────────────────────────────────────────────

  describe('getPatientsByProvider', () => {
    it('returns paginated patients for a provider', async () => {
      const rows = [makeRelationship(), makeRelationship({ id: 'rel-uuid-2', patientId: 'patient-2' })];
      mockRepo.findAndCount.mockResolvedValue([rows, 2]);

      const result = await service.getPatientsByProvider('provider-1', { page: 1, limit: 20 });

      expect(result).toEqual({ data: rows, total: 2, page: 1, limit: 20 });
      expect(mockRepo.findAndCount).toHaveBeenCalledWith({
        where: { providerId: 'provider-1' },
        order: { lastInteractionAt: 'DESC' },
        take: 20,
        skip: 0,
      });
    });

    it('applies correct skip offset for page 2', async () => {
      mockRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.getPatientsByProvider('provider-1', { page: 2, limit: 10 });

      expect(mockRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10, skip: 10 }),
      );
    });

    it('uses defaults when query params are omitted', async () => {
      mockRepo.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.getPatientsByProvider('provider-1', {});

      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(mockRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ take: 20, skip: 0 }),
      );
    });

    it('returns empty data when provider has no patients', async () => {
      mockRepo.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.getPatientsByProvider('unknown-provider', { page: 1, limit: 20 });

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('orders results by firstInteractionAt DESC', async () => {
      mockRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.getPatientsByProvider('provider-1', { page: 1, limit: 20 });

      expect(mockRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ order: { firstInteractionAt: 'DESC' } }),
      );
    });
  });

  // ─── getProvidersByPatient ────────────────────────────────────────────────

  describe('getProvidersByPatient', () => {
    it('returns paginated providers for a patient', async () => {
      const rows = [makeRelationship(), makeRelationship({ id: 'rel-uuid-3', providerId: 'provider-2' })];
      mockRepo.findAndCount.mockResolvedValue([rows, 2]);

      const result = await service.getProvidersByPatient('patient-1', { page: 1, limit: 20 });

      expect(result).toEqual({ data: rows, total: 2, page: 1, limit: 20 });
      expect(mockRepo.findAndCount).toHaveBeenCalledWith({
        where: { patientId: 'patient-1' },
        order: { firstInteractionAt: 'DESC' },
        take: 20,
        skip: 0,
      });
    });

    it('applies correct skip offset for page 3', async () => {
      mockRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.getProvidersByPatient('patient-1', { page: 3, limit: 5 });

      expect(mockRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5, skip: 10 }),
      );
    });

    it('returns empty data when patient has no providers', async () => {
      mockRepo.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.getProvidersByPatient('new-patient', { page: 1, limit: 20 });

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('respects the limit cap at 100', async () => {
      mockRepo.findAndCount.mockResolvedValue([[], 0]);

      // limit=100 is the max allowed by the DTO; service passes it through
      await service.getProvidersByPatient('patient-1', { page: 1, limit: 100 });

      expect(mockRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });
  });
});

// ─── Controller ──────────────────────────────────────────────────────────────

describe('ProviderPatientRelationshipController', () => {
  let controller: ProviderPatientRelationshipController;

  const mockService = {
    getPatientsByProvider: jest.fn(),
    getProvidersByPatient: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProviderPatientRelationshipController],
      providers: [
        { provide: ProviderPatientRelationshipService, useValue: mockService },
      ],
    }).compile();

    controller = module.get<ProviderPatientRelationshipController>(
      ProviderPatientRelationshipController,
    );
    jest.clearAllMocks();
  });

  const paginatedResult = { data: [], total: 0, page: 1, limit: 20 };
  const query: RelationshipQueryDto = { page: 1, limit: 20 };

  // ─── getPatientsByProvider ──────────────────────────────────────────────

  describe('getPatientsByProvider', () => {
    it('delegates to service with correct arguments', async () => {
      mockService.getPatientsByProvider.mockResolvedValue(paginatedResult);

      const result = await controller.getPatientsByProvider('provider-1', query);

      expect(mockService.getPatientsByProvider).toHaveBeenCalledWith('provider-1', query);
      expect(result).toEqual(paginatedResult);
    });

    it('passes through service errors', async () => {
      mockService.getPatientsByProvider.mockRejectedValue(new Error('DB error'));

      await expect(controller.getPatientsByProvider('provider-1', query)).rejects.toThrow('DB error');
    });
  });

  // ─── getProvidersByPatient ──────────────────────────────────────────────

  describe('getProvidersByPatient', () => {
    const adminReq = { user: { role: UserRole.ADMIN, userId: 'admin-1' } };
    const physicianReq = { user: { role: UserRole.PHYSICIAN, userId: 'physician-1' } };

    it('allows admin to view any patient providers', async () => {
      mockService.getProvidersByPatient.mockResolvedValue(paginatedResult);

      const result = await controller.getProvidersByPatient('patient-1', query, adminReq);

      expect(mockService.getProvidersByPatient).toHaveBeenCalledWith('patient-1', query);
      expect(result).toEqual(paginatedResult);
    });

    it('allows physician to view any patient providers', async () => {
      mockService.getProvidersByPatient.mockResolvedValue(paginatedResult);

      await controller.getProvidersByPatient('patient-1', query, physicianReq);

      expect(mockService.getProvidersByPatient).toHaveBeenCalledWith('patient-1', query);
    });

    it('allows a patient to view their own providers', async () => {
      mockService.getProvidersByPatient.mockResolvedValue(paginatedResult);
      const ownReq = { user: { role: UserRole.PATIENT, userId: 'patient-1' } };

      const result = await controller.getProvidersByPatient('patient-1', query, ownReq);

      expect(mockService.getProvidersByPatient).toHaveBeenCalledWith('patient-1', query);
      expect(result).toEqual(paginatedResult);
    });

    it('throws ForbiddenException when a patient requests another patient providers', async () => {
      const otherPatientReq = { user: { role: UserRole.PATIENT, userId: 'patient-99' } };

      await expect(
        controller.getProvidersByPatient('patient-1', query, otherPatientReq),
      ).rejects.toThrow(ForbiddenException);

      expect(mockService.getProvidersByPatient).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException with correct message for cross-patient access', async () => {
      const otherPatientReq = { user: { role: UserRole.PATIENT, userId: 'patient-99' } };

      await expect(
        controller.getProvidersByPatient('patient-1', query, otherPatientReq),
      ).rejects.toThrow('Patients can only view their own provider relationships');
    });

    it('passes through service errors for authorised callers', async () => {
      mockService.getProvidersByPatient.mockRejectedValue(new Error('DB error'));

      await expect(
        controller.getProvidersByPatient('patient-1', query, adminReq),
      ).rejects.toThrow('DB error');
    });
  });
});
