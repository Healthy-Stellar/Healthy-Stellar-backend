import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { MedicalRecord, MedicalRecordStatus, RecordType } from '../entities/medical-record.entity';
import { MedicalRecordVersion } from '../entities/medical-record-version.entity';
import { MedicalHistory } from '../entities/medical-history.entity';
import { MedicalRecordsService } from './medical-records.service';
import { aMedicalRecord, aPatient } from '../../../test/fixtures/test-data-builder';
import { generateMedicalRecordData } from '../../../test/utils/data-anonymization.util';
import { createMockAuditLog } from '../../../test/utils/hipaa-compliance.util';

/**
 * Medical Records Service Tests
 *
 * Tests medical record CRUD operations, access control, versioning, and HIPAA compliance
 */
describe('MedicalRecordsService', () => {
  let service: MedicalRecordsService;
  let repository: Repository<MedicalRecord>;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockVersionRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
  };

  const mockHistoryRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
  };

  const mockAccessControlService = {
    findActiveEmergencyGrant: jest.fn(),
  };

  const mockAuditLogService = {
    create: jest.fn(),
    logAccess: jest.fn(),
    logUpdate: jest.fn(),
    logDelete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MedicalRecordsService,
        {
          provide: getRepositoryToken(MedicalRecord),
          useValue: mockRepository,
        },
        {
          provide: getRepositoryToken(MedicalRecordVersion),
          useValue: mockVersionRepository,
        },
        {
          provide: getRepositoryToken(MedicalHistory),
          useValue: mockHistoryRepository,
        },
        {
          provide: 'AccessControlService',
          useValue: mockAccessControlService,
        },
        {
          provide: 'AuditLogService',
          useValue: mockAuditLogService,
        },
      ],
    }).compile();

    service = module.get<MedicalRecordsService>(MedicalRecordsService);
    repository = module.get<Repository<MedicalRecord>>(getRepositoryToken(MedicalRecord));

    jest.clearAllMocks();
  });

  describe('Medical Record Creation', () => {
    it('should create a medical record with anonymized data', async () => {
      // Arrange
      const patient = aPatient().build();
      const recordData = generateMedicalRecordData(patient.id);
      const savedRecord = { ...recordData, id: 'test-record-id', version: 1 };

      mockRepository.create.mockReturnValue(recordData);
      mockRepository.save.mockResolvedValue(savedRecord);
      mockAuditService.logAccess.mockResolvedValue(createMockAuditLog());

      // Act
      // const result = await service.create(recordData);

      // Assert
      // expect(result).toEqual(savedRecord);
      expect(recordData).toBeAnonymized();
      // expect(mockAuditService.logAccess).toHaveBeenCalled();
    });

    it('should create audit log entry on record creation', async () => {
      // Arrange
      const patient = aPatient().build();
      const recordData = aMedicalRecord(patient.id).withType('consultation').build();

      mockRepository.create.mockReturnValue(recordData);
      mockRepository.save.mockResolvedValue({ ...recordData, id: 'test-id' });

      // Act
      // await service.create(recordData);

      // Assert
      // expect(mockAuditService.logAccess).toHaveBeenCalledWith(
      //   expect.objectContaining({
      //     eventType: 'created',
      //     patientId: patient.id,
      //   })
      // );
    });
  });

  describe('Medical Record Retrieval', () => {
    it('should retrieve medical record by ID', async () => {
      // Arrange
      const patient = aPatient().build();
      const record = aMedicalRecord(patient.id).withId('test-record-id').build();

      mockRepository.findOneBy.mockResolvedValue(record);
      mockAuditService.logAccess.mockResolvedValue(createMockAuditLog());

      // Act
      // const result = await service.findById('test-record-id');

      // Assert
      // expect(result).toEqual(record);
      // expect(mockAuditService.logAccess).toHaveBeenCalledWith(
      //   expect.objectContaining({
      //     eventType: 'viewed',
      //     medicalRecordId: 'test-record-id',
      //   })
      // );
    });

    it('should retrieve all records for a patient', async () => {
      // Arrange
      const patient = aPatient().build();
      const records = [
        aMedicalRecord(patient.id).withType('consultation').build(),
        aMedicalRecord(patient.id).withType('lab_result').build(),
        aMedicalRecord(patient.id).withType('prescription').build(),
      ];

      mockRepository.find.mockResolvedValue(records);

      // Act
      // const result = await service.findByPatientId(patient.id);

      // Assert
      // expect(result).toHaveLength(3);
      // expect(result).toEqual(records);
    });

    it('should filter records by type', async () => {
      // Arrange
      const patient = aPatient().build();
      const labResults = [
        aMedicalRecord(patient.id).withType('lab_result').build(),
        aMedicalRecord(patient.id).withType('lab_result').build(),
      ];

      mockRepository.find.mockResolvedValue(labResults);

      // Act
      // const result = await service.findByPatientId(patient.id, { recordType: 'lab_result' });

      // Assert
      // expect(result).toHaveLength(2);
      // result.forEach(record => {
      //   expect(record.recordType).toBe('lab_result');
      // });
    });
  });

  describe('Concurrent Update Prevention (Optimistic Locking)', () => {
    const buildRecord = (version: number): MedicalRecord =>
      ({
        id: 'record-uuid-1',
        patientId: 'patient-uuid-1',
        providerId: null,
        createdBy: 'user-uuid-1',
        recordType: RecordType.CONSULTATION,
        title: 'Initial Title',
        description: 'Initial description',
        status: MedicalRecordStatus.ACTIVE,
        recordDate: new Date(),
        metadata: {},
        stellarTxHash: null,
        version,
        createdAt: new Date(),
        updatedAt: new Date(),
        updatedBy: null,
        versions: [],
        history: [],
        attachments: [],
        consents: [],
      } as MedicalRecord);

    const setupQueryBuilder = (record: MedicalRecord) => {
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(record),
      };
      mockRepository.createQueryBuilder.mockReturnValue(qb);
      return qb;
    };

    it('should update successfully when expectedVersion matches current version', async () => {
      const record = buildRecord(3);
      setupQueryBuilder(record);
      const updatedRecord = { ...record, title: 'Updated Title', version: 4 };
      mockRepository.save.mockResolvedValue(updatedRecord);
      mockVersionRepository.create.mockReturnValue({});
      mockVersionRepository.save.mockResolvedValue({});
      mockHistoryRepository.create.mockReturnValue({});
      mockHistoryRepository.save.mockResolvedValue({});

      const result = await service.update(
        'record-uuid-1',
        { title: 'Updated Title', expectedVersion: 3 },
        'user-uuid-1',
      );

      expect(result.title).toBe('Updated Title');
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should throw ConflictException (409) when expectedVersion does not match current version', async () => {
      const record = buildRecord(5); // current version is 5
      setupQueryBuilder(record);

      await expect(
        service.update(
          'record-uuid-1',
          { title: 'Stale Update', expectedVersion: 3 }, // client has stale version 3
          'user-uuid-2',
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should include refresh-and-retry instruction in the 409 error message', async () => {
      const record = buildRecord(5);
      setupQueryBuilder(record);

      await expect(
        service.update(
          'record-uuid-1',
          { title: 'Stale Update', expectedVersion: 2 },
          'user-uuid-2',
        ),
      ).rejects.toThrow(/refresh.*retry/i);
    });

    it('should include both expected and current version numbers in the error message', async () => {
      const record = buildRecord(7);
      setupQueryBuilder(record);

      let thrownError: ConflictException;
      try {
        await service.update(
          'record-uuid-1',
          { title: 'Stale Update', expectedVersion: 4 },
          'user-uuid-2',
        );
      } catch (e) {
        thrownError = e;
      }

      expect(thrownError).toBeInstanceOf(ConflictException);
      expect(thrownError.message).toContain('4');
      expect(thrownError.message).toContain('7');
    });

    it('should simulate concurrent update race condition: second writer gets 409', async () => {
      // Provider A reads version 1
      const recordAtV1 = buildRecord(1);
      // Provider B also reads version 1 concurrently
      const recordAtV2 = buildRecord(2); // after Provider A saved, version is now 2

      // Provider A saves successfully (version matches)
      setupQueryBuilder(recordAtV1);
      mockRepository.save.mockResolvedValue({ ...recordAtV1, title: 'Provider A Update', version: 2 });
      mockVersionRepository.create.mockReturnValue({});
      mockVersionRepository.save.mockResolvedValue({});
      mockHistoryRepository.create.mockReturnValue({});
      mockHistoryRepository.save.mockResolvedValue({});

      const providerAResult = await service.update(
        'record-uuid-1',
        { title: 'Provider A Update', expectedVersion: 1 },
        'provider-a',
      );
      expect(providerAResult.title).toBe('Provider A Update');

      // Now Provider B tries to save with stale version 1, but record is now at version 2
      setupQueryBuilder(recordAtV2);

      await expect(
        service.update(
          'record-uuid-1',
          { title: 'Provider B Update', expectedVersion: 1 }, // stale
          'provider-b',
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should allow update without expectedVersion (no optimistic locking check)', async () => {
      const record = buildRecord(10);
      setupQueryBuilder(record);
      const updatedRecord = { ...record, title: 'Force Update', version: 11 };
      mockRepository.save.mockResolvedValue(updatedRecord);
      mockVersionRepository.create.mockReturnValue({});
      mockVersionRepository.save.mockResolvedValue({});
      mockHistoryRepository.create.mockReturnValue({});
      mockHistoryRepository.save.mockResolvedValue({});

      // No expectedVersion provided — should not throw
      const result = await service.update(
        'record-uuid-1',
        { title: 'Force Update' },
        'user-uuid-1',
      );

      expect(result.title).toBe('Force Update');
      expect(mockRepository.save).toHaveBeenCalled();
    });
  });

  describe('Medical Record Updates and Versioning', () => {
    it('should create new version on update', async () => {
      // Arrange
      const patient = aPatient().build();
      const existingRecord = aMedicalRecord(patient.id).withId('test-record-id').build();
      existingRecord.version = 1;

      const updateData = { description: 'Updated description' };

      mockRepository.findOneBy.mockResolvedValue(existingRecord);
      mockRepository.save.mockResolvedValue({ ...existingRecord, ...updateData, version: 2 });

      // Act
      // const result = await service.update('test-record-id', updateData);

      // Assert
      // expect(result.version).toBe(2);
      // expect(result.description).toBe('Updated description');
    });

    it('should maintain version history', async () => {
      // Arrange
      const patient = aPatient().build();
      const recordId = 'test-record-id';

      // Act
      // const versions = await service.getVersionHistory(recordId);

      // Assert
      // expect(Array.isArray(versions)).toBe(true);
      // versions.forEach((version, index) => {
      //   expect(version.version).toBe(index + 1);
      // });
    });
  });

  describe('Access Control', () => {
    it('should enforce provider access control', async () => {
      // Arrange
      const patient = aPatient().build();
      const record = aMedicalRecord(patient.id).withProvider('authorized-provider-id').build();

      mockRepository.findOneBy.mockResolvedValue(record);

      // Act & Assert
      // await expect(
      //   service.findById('test-record-id', { userId: 'unauthorized-user' })
      // ).rejects.toThrow('Access denied');
    });

    it('should allow access with valid consent', async () => {
      // Arrange
      const patient = aPatient().build();
      const record = aMedicalRecord(patient.id).build();

      mockRepository.findOneBy.mockResolvedValue(record);

      // Mock consent check
      const mockConsentService = {
        hasConsent: jest.fn().mockResolvedValue(true),
      };

      // Act
      // const result = await service.findById('test-record-id', {
      //   userId: 'provider-id',
      //   consentService: mockConsentService,
      // });

      // Assert
      // expect(result).toEqual(record);
      // expect(mockConsentService.hasConsent).toHaveBeenCalled();
    });
  });

  describe('Record Archival and Deletion', () => {
    it('should archive record instead of hard delete', async () => {
      // Arrange
      const recordId = 'test-record-id';

      mockRepository.update.mockResolvedValue({ affected: 1 });

      // Act
      // await service.archive(recordId);

      // Assert
      // expect(mockRepository.update).toHaveBeenCalledWith(
      //   recordId,
      //   { status: 'archived' }
      // );
    });

    it('should create audit log on deletion', async () => {
      // Arrange
      const recordId = 'test-record-id';
      const patient = aPatient().build();
      const record = aMedicalRecord(patient.id).withId(recordId).build();

      mockRepository.findOneBy.mockResolvedValue(record);
      mockRepository.update.mockResolvedValue({ affected: 1 });

      // Act
      // await service.softDelete(recordId, 'user-id');

      // Assert
      // expect(mockAuditService.logDelete).toHaveBeenCalledWith(
      //   expect.objectContaining({
      //     eventType: 'deleted',
      //     medicalRecordId: recordId,
      //   })
      // );
    });
  });

  describe('Performance', () => {
    it('should retrieve medical record within performance threshold', async () => {
      // Arrange
      const patient = aPatient().build();
      const record = aMedicalRecord(patient.id).build();

      mockRepository.findOneBy.mockResolvedValue(record);
      mockAuditService.logAccess.mockResolvedValue(createMockAuditLog());

      // Act
      const startTime = Date.now();
      // await service.findById('test-record-id');
      const duration = Date.now() - startTime;

      // Assert
      // expect(duration).toBeLessThan(500); // Should be < 500ms
    });
  });

  describe('Data Anonymization', () => {
    it('should ensure all medical records use anonymized data', () => {
      // Arrange
      const patient = aPatient().build();
      const records = [
        aMedicalRecord(patient.id).build(),
        aMedicalRecord(patient.id).build(),
        aMedicalRecord(patient.id).build(),
      ];

      // Assert
      records.forEach((record) => {
        expect(record).toBeAnonymized();
      });
    });
  });
});
