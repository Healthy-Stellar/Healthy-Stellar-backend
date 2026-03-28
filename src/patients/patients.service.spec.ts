import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PatientsService } from './patients.service';
import { Patient } from './entities/patient.entity';
import { AuditLogEntity } from '../common/audit/audit-log.entity';
import { aPatient } from '../../test/fixtures/test-data-builder';

// ─── Blockchain mock (Stellar SDK is mocked globally in setup-unit.ts) ────────
const mockStellarInvokeContract = jest.fn();
const mockStellarGetPatient = jest.fn();
const mockStellarDeregister = jest.fn();

jest.mock('../stellar/services/stellar.service', () => ({
  StellarService: jest.fn().mockImplementation(() => ({
    invokeContract: mockStellarInvokeContract,
    getAccount: mockStellarGetPatient,
    revokeAccess: mockStellarDeregister,
  })),
}));

// ─── Repository mock ──────────────────────────────────────────────────────────
const mockRepo = {
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  findOneBy: jest.fn(),
  update: jest.fn(),
};

// ─── QueryRunner / DataSource mock ───────────────────────────────────────────
const mockQR = {
  connect: jest.fn(),
  startTransaction: jest.fn(),
  commitTransaction: jest.fn(),
  rollbackTransaction: jest.fn(),
  release: jest.fn(),
  manager: {
    findOne: jest.fn(),
    update: jest.fn(),
    save: jest.fn(),
    create: jest.fn((entity: any, data: any) => data),
  },
};

const mockDataSource = {
  createQueryRunner: jest.fn().mockReturnValue(mockQR),
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeValidDto(overrides: Record<string, any> = {}) {
  return {
    firstName: 'Jane',
    lastName: 'Doe',
    dateOfBirth: '1990-01-01',
    sex: 'female' as const,
    ...overrides,
  };
}

describe('PatientsService', () => {
  let service: PatientsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PatientsService,
        { provide: getRepositoryToken(Patient), useValue: mockRepo },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<PatientsService>(PatientsService);
    jest.clearAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // registerPatient  (→ create)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('registerPatient (create)', () => {
    it('success — creates and returns a new patient', async () => {
      const dto = makeValidDto();
      const saved = { ...dto, id: 'uuid-1', mrn: 'MRN-001', isActive: true, isAdmitted: false };

      mockRepo.findOneBy.mockResolvedValue(null); // no MRN conflict
      mockRepo.findOne.mockResolvedValue(null);   // no duplicate
      mockRepo.create.mockReturnValue(saved);
      mockRepo.save.mockResolvedValue(saved);

      const result = await service.create(dto);

      expect(result).toEqual(saved);
      expect(mockRepo.create).toHaveBeenCalled();
      expect(mockRepo.save).toHaveBeenCalled();
    });

    it('already registered — throws ConflictException on duplicate detection', async () => {
      const dto = makeValidDto({ nationalId: 'ID-123' });

      mockRepo.findOneBy.mockResolvedValue(null);
      // detectDuplicate returns a match
      mockRepo.findOne.mockResolvedValue(aPatient().build());

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('already registered — throws ConflictException when MRN already exists', async () => {
      const dto = makeValidDto({ mrn: 'MRN-EXISTING' } as any);

      mockRepo.findOneBy.mockResolvedValue(aPatient().withMRN('MRN-EXISTING').build());

      await expect(service.create(dto as any)).rejects.toThrow(ConflictException);
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('contract failure — throws BadRequestException on invalid date of birth', async () => {
      const dto = makeValidDto({ dateOfBirth: 'not-a-date' });

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('blockchain mock is never called during patient registration (off-chain only)', async () => {
      const dto = makeValidDto();
      const saved = { ...dto, id: 'uuid-2', mrn: 'MRN-002', isActive: true, isAdmitted: false };

      mockRepo.findOneBy.mockResolvedValue(null);
      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.create.mockReturnValue(saved);
      mockRepo.save.mockResolvedValue(saved);

      await service.create(dto);

      // Stellar contract must NOT be called — all blockchain calls are mocked
      expect(mockStellarInvokeContract).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getPatient  (→ findById)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('getPatient (findById)', () => {
    it('found — returns the patient when ID exists', async () => {
      const patient = aPatient().withId('uuid-found').build();
      mockRepo.findOne.mockResolvedValue(patient);

      const result = await service.findById('uuid-found');

      expect(result).toEqual(patient);
      expect(mockRepo.findOne).toHaveBeenCalledWith({ where: { id: 'uuid-found' } });
    });

    it('not found — throws NotFoundException when ID does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.findById('non-existent-id')).rejects.toThrow(NotFoundException);
    });

    it('blockchain mock is never called during patient lookup', async () => {
      const patient = aPatient().build();
      mockRepo.findOne.mockResolvedValue(patient);

      await service.findById(patient.id);

      expect(mockStellarGetPatient).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // updateProfile
  // ═══════════════════════════════════════════════════════════════════════════
  describe('updateProfile', () => {
    const stellarAddress = 'GABC123STELLAR';

    it('authorized — updates mutable fields for the matching stellarAddress', async () => {
      const existing = aPatient().build();
      (existing as any).stellarAddress = stellarAddress;
      const profileData = { phone: '555-9999', email: 'new@example.com' };
      const updated = { ...existing, ...profileData };

      mockRepo.findOne.mockResolvedValue(existing);
      mockRepo.save.mockResolvedValue(updated);

      const result = await service.updateProfile(stellarAddress, profileData);

      expect(mockRepo.findOne).toHaveBeenCalledWith({ where: { stellarAddress } });
      expect(mockRepo.save).toHaveBeenCalled();
      expect(result.phone).toBe('555-9999');
      expect(result.email).toBe('new@example.com');
    });

    it('unauthorized — throws NotFoundException when stellarAddress has no match', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateProfile('INVALID_STELLAR', { phone: '555-0000' }),
      ).rejects.toThrow(NotFoundException);

      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('does not overwrite immutable fields (stellarAddress, nationalIdHash)', async () => {
      const existing = aPatient().build();
      (existing as any).stellarAddress = stellarAddress;
      (existing as any).nationalIdHash = 'original-hash';

      mockRepo.findOne.mockResolvedValue(existing);
      mockRepo.save.mockImplementation(async (p: any) => p);

      const result = await service.updateProfile(stellarAddress, { phone: '555-1234' } as any);

      expect((result as any).stellarAddress).toBe(stellarAddress);
      expect((result as any).nationalIdHash).toBe('original-hash');
    });

    it('blockchain mock is never called during profile update', async () => {
      const existing = aPatient().build();
      (existing as any).stellarAddress = stellarAddress;

      mockRepo.findOne.mockResolvedValue(existing);
      mockRepo.save.mockResolvedValue(existing);

      await service.updateProfile(stellarAddress, { phone: '555-0001' });

      expect(mockStellarInvokeContract).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // deregisterPatient  (→ softDelete)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('deregisterPatient (softDelete)', () => {
    it('success — marks patient as inactive', async () => {
      mockRepo.update.mockResolvedValue({ affected: 1 });

      await service.softDelete('patient-id');

      expect(mockRepo.update).toHaveBeenCalledWith('patient-id', { isActive: false });
    });

    it('with active grants — soft-delete still completes (grants managed separately)', async () => {
      // softDelete only deactivates the patient; access grants are handled by adminMergePatients
      // or a dedicated access-control service — the service itself does not block on grants
      mockRepo.update.mockResolvedValue({ affected: 1 });

      await expect(service.softDelete('patient-with-grants')).resolves.toBeUndefined();
      expect(mockRepo.update).toHaveBeenCalledWith('patient-with-grants', { isActive: false });
    });

    it('blockchain mock is never called during deregistration', async () => {
      mockRepo.update.mockResolvedValue({ affected: 1 });

      await service.softDelete('patient-id');

      expect(mockStellarDeregister).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // adminMergePatients — transaction coverage
  // ═══════════════════════════════════════════════════════════════════════════
  describe('adminMergePatients', () => {
    it('success — merges two patients and commits transaction', async () => {
      const primary = aPatient().withId('primary-id').build();
      const secondary = aPatient().withId('secondary-id').build();

      mockQR.manager.findOne
        .mockResolvedValueOnce(primary)
        .mockResolvedValueOnce(secondary);

      const result = await service.adminMergePatients(
        { primaryAddress: 'primary-id', secondaryAddress: 'secondary-id', reason: 'Duplicate' },
        'admin-id',
      );

      expect(mockQR.startTransaction).toHaveBeenCalled();
      expect(mockQR.manager.update).toHaveBeenCalledWith(
        'records',
        { patientId: 'secondary-id' },
        { patientId: 'primary-id' },
      );
      expect(mockQR.manager.update).toHaveBeenCalledWith(
        'access_grants',
        { patientId: 'secondary-id' },
        { patientId: 'primary-id' },
      );
      expect(secondary.isActive).toBe(false);
      expect(mockQR.manager.save).toHaveBeenCalledWith(Patient, secondary);
      expect(mockQR.manager.save).toHaveBeenCalledWith(
        AuditLogEntity,
        expect.objectContaining({ action: 'PATIENT_MERGING' }),
      );
      expect(mockQR.manager.save).toHaveBeenCalledWith(
        AuditLogEntity,
        expect.objectContaining({ action: 'PATIENT_MERGED' }),
      );
      expect(mockQR.commitTransaction).toHaveBeenCalled();
      expect(mockQR.release).toHaveBeenCalled();
      expect(result).toEqual(primary);
    });

    it('rolls back transaction on DB error', async () => {
      mockQR.manager.findOne.mockRejectedValueOnce(new Error('DB Error'));

      await expect(
        service.adminMergePatients(
          { primaryAddress: 'a', secondaryAddress: 'b' },
          'admin-id',
        ),
      ).rejects.toThrow('DB Error');

      expect(mockQR.rollbackTransaction).toHaveBeenCalled();
      expect(mockQR.release).toHaveBeenCalled();
    });

    it('throws BadRequestException when merging a patient with itself', async () => {
      const patient = aPatient().withId('same-id').build();
      mockQR.manager.findOne
        .mockResolvedValueOnce(patient)
        .mockResolvedValueOnce(patient);

      await expect(
        service.adminMergePatients(
          { primaryAddress: 'same-id', secondaryAddress: 'same-id' },
          'admin-id',
        ),
      ).rejects.toThrow(BadRequestException);

      expect(mockQR.rollbackTransaction).toHaveBeenCalled();
    });

    it('throws NotFoundException when one patient is missing', async () => {
      mockQR.manager.findOne
        .mockResolvedValueOnce(aPatient().build())
        .mockResolvedValueOnce(null);

      await expect(
        service.adminMergePatients(
          { primaryAddress: 'a', secondaryAddress: 'missing' },
          'admin-id',
        ),
      ).rejects.toThrow(NotFoundException);

      expect(mockQR.rollbackTransaction).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Additional coverage — admit / discharge / search / setGeoRestrictions
  // ═══════════════════════════════════════════════════════════════════════════
  describe('admit', () => {
    it('sets isAdmitted=true and saves', async () => {
      const patient = aPatient().build();
      patient.isAdmitted = false;
      mockRepo.findOne.mockResolvedValue(patient);
      mockRepo.save.mockImplementation(async (p: any) => p);

      const result = await service.admit(patient.id);

      expect(result.isAdmitted).toBe(true);
      expect(mockRepo.save).toHaveBeenCalled();
    });

    it('throws NotFoundException for unknown id', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.admit('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('discharge', () => {
    it('sets isAdmitted=false and saves', async () => {
      const patient = aPatient().admitted().build();
      mockRepo.findOne.mockResolvedValue(patient);
      mockRepo.save.mockImplementation(async (p: any) => p);

      const result = await service.discharge(patient.id);

      expect(result.isAdmitted).toBe(false);
    });
  });

  describe('search', () => {
    it('returns up to 20 results matching the search term', async () => {
      const patients = [aPatient().build(), aPatient().build()];
      mockRepo.find.mockResolvedValue(patients);

      const result = await service.search('Jane');

      expect(result).toHaveLength(2);
      expect(mockRepo.find).toHaveBeenCalled();
    });

    it('returns all patients (limited) when search term is empty', async () => {
      mockRepo.find.mockResolvedValue([]);
      await service.search('');
      expect(mockRepo.find).toHaveBeenCalledWith({ take: 20 });
    });
  });

  describe('setGeoRestrictions', () => {
    it('uppercases and stores allowed countries', async () => {
      const patient = aPatient().build();
      mockRepo.findOne.mockResolvedValue(patient);
      mockRepo.save.mockImplementation(async (p: any) => p);

      const result = await service.setGeoRestrictions(patient.id, ['us', 'gb']);

      expect(result.allowedCountries).toEqual(['US', 'GB']);
    });

    it('sets allowedCountries to null when empty array is passed', async () => {
      const patient = aPatient().build();
      mockRepo.findOne.mockResolvedValue(patient);
      mockRepo.save.mockImplementation(async (p: any) => p);

      const result = await service.setGeoRestrictions(patient.id, []);

      expect(result.allowedCountries).toBeNull();
    });
  });

  describe('update', () => {
    it('updates and returns the patient', async () => {
      const patient = aPatient().build();
      mockRepo.update.mockResolvedValue({ affected: 1 });
      mockRepo.findOneBy.mockResolvedValue({ ...patient, phone: '555-0001' });

      const result = await service.update(patient.id, { phone: '555-0001' } as any);

      expect(result.phone).toBe('555-0001');
    });

    it('throws NotFoundException when patient does not exist after update', async () => {
      mockRepo.update.mockResolvedValue({ affected: 0 });
      mockRepo.findOneBy.mockResolvedValue(null);

      await expect(service.update('bad-id', {})).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByMRN', () => {
    it('returns patient when MRN exists', async () => {
      const patient = aPatient().withMRN('MRN-001').build();
      mockRepo.findOneBy.mockResolvedValue(patient);

      const result = await service.findByMRN('MRN-001');

      expect(result).toEqual(patient);
      expect(mockRepo.findOneBy).toHaveBeenCalledWith({ mrn: 'MRN-001' });
    });

    it('returns null when MRN does not exist', async () => {
      mockRepo.findOneBy.mockResolvedValue(null);

      const result = await service.findByMRN('MRN-MISSING');

      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    it('returns all patients without pagination when no paginationDto provided', async () => {
      const patients = [aPatient().build(), aPatient().build()];
      mockRepo.find.mockResolvedValue(patients);

      const result = await service.findAll();

      expect(result.data).toHaveLength(2);
      expect(mockRepo.find).toHaveBeenCalled();
    });

    it('applies filters when provided without paginationDto', async () => {
      const patients = [aPatient().admitted().build()];
      mockRepo.find.mockResolvedValue(patients);

      const result = await service.findAll(undefined, { isAdmitted: true });

      expect(result.data).toHaveLength(1);
      expect(mockRepo.find).toHaveBeenCalledWith({ where: { isAdmitted: true } });
    });

    it('uses PaginationUtil.paginate when paginationDto is provided', async () => {
      const patients = [aPatient().build()];
      mockRepo.findAndCount = jest.fn().mockResolvedValue([patients, 1]);

      const result = await service.findAll({ page: 1, pageSize: 10 });

      expect(result.data).toHaveLength(1);
      expect(mockRepo.findAndCount).toHaveBeenCalled();
    });
  });

  describe('attachPhoto', () => {
    it('sets patientPhotoUrl and saves', async () => {
      const patient = aPatient().build();
      mockRepo.findOne.mockResolvedValue(patient);
      mockRepo.save.mockImplementation(async (p: any) => p);

      const file = { filename: 'photo-123.jpg' } as Express.Multer.File;
      const result = await service.attachPhoto(patient.id, file);

      expect(result.patientPhotoUrl).toBe('/uploads/patients/photos/photo-123.jpg');
      expect(mockRepo.save).toHaveBeenCalled();
    });

    it('throws NotFoundException when patient not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(
        service.attachPhoto('bad-id', { filename: 'x.jpg' } as Express.Multer.File),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
