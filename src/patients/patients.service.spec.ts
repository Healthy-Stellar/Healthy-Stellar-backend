import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PatientsService } from './patients.service';
import { Patient } from './entities/patient.entity';
import { aPatient } from '../../test/fixtures/test-data-builder';
import { generatePatientDemographics } from '../../test/utils/data-anonymization.util';

describe('PatientsService', () => {
  let service: PatientsService;
  let repository: Repository<Patient>;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PatientsService,
        {
          provide: getRepositoryToken(Patient),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<PatientsService>(PatientsService);
    repository = module.get<Repository<Patient>>(getRepositoryToken(Patient));

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Patient CRUD Operations with Anonymized Data', () => {
    it('should create a patient with anonymized data', async () => {
      // Arrange
      const patientData = generatePatientDemographics({ deterministic: true, seed: 123 });
      const savedPatient = { ...patientData, id: 'test-uuid-1234' };

      mockRepository.create.mockReturnValue(patientData);
      mockRepository.save.mockResolvedValue(savedPatient);

      // Act
      const result = await service.create(patientData);

      // Assert
      expect(result).toEqual(savedPatient);
      expect(mockRepository.create).toHaveBeenCalledWith(patientData);
      expect(mockRepository.save).toHaveBeenCalled();
      expect(result).toBeAnonymized();
    });

    it('should find patient by MRN', async () => {
      // Arrange
      const patient = aPatient({ deterministic: true, seed: 456 })
        .withMRN('MRN-20240101-1234')
        .build();

      mockRepository.findOneBy.mockResolvedValue(patient);

      // Act
      const result = await service.findByMRN('MRN-20240101-1234');

      // Assert
      expect(result).toEqual(patient);
      expect(mockRepository.findOneBy).toHaveBeenCalledWith({ mrn: 'MRN-20240101-1234' });
      expect(result).toBeAnonymized();
    });

    it('should find all active patients', async () => {
      // Arrange
      const patients = [aPatient().build(), aPatient().build(), aPatient().build()];

      mockRepository.find.mockResolvedValue(patients);

      // Act
      const result = await service.findAll({ isActive: true });

      // Assert
      expect(result).toHaveLength(3);
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { isActive: true },
      });
      result.forEach((patient) => {
        expect(patient).toBeAnonymized();
      });
    });

    it('should update patient information', async () => {
      // Arrange
      const patientId = 'test-patient-id';
      const updateData = { phone: '555-0123', email: 'test@example.com' };
      const updatedPatient = aPatient()
        .withId(patientId)
        .withContact('555-0123', 'test@example.com')
        .build();

      mockRepository.update.mockResolvedValue({ affected: 1 });
      mockRepository.findOneBy.mockResolvedValue(updatedPatient);

      // Act
      const result = await service.update(patientId, updateData);

      // Assert
      expect(result).toEqual(updatedPatient);
      expect(mockRepository.update).toHaveBeenCalledWith(patientId, updateData);
      expect(result).toBeAnonymized();
    });

    it('should soft delete patient by marking as inactive', async () => {
      // Arrange
      const patientId = 'test-patient-id';
      mockRepository.update.mockResolvedValue({ affected: 1 });

      // Act
      await service.softDelete(patientId);

      // Assert
      expect(mockRepository.update).toHaveBeenCalledWith(patientId, { isActive: false });
    });
  });

  describe('PHI Field Protection', () => {
    it('should protect PHI fields in patient data', () => {
      // Arrange
      const patient = aPatient().build();

      // Assert
      expect(patient).toHavePHIProtection([
        'firstName',
        'lastName',
        'email',
        'phone',
        'nationalId',
        'address',
      ]);
    });

    it('should not expose real PHI in test data', () => {
      // Arrange
      const patients = [
        generatePatientDemographics(),
        generatePatientDemographics(),
        generatePatientDemographics(),
      ];

      // Assert
      patients.forEach((patient) => {
        expect(patient).toBeAnonymized();
      });
    });
  });

  describe('Patient Search and Filtering', () => {
    it('should search patients by name', async () => {
      // Arrange
      const searchTerm = 'John';
      const matchingPatients = [
        aPatient().withName('John', 'Doe').build(),
        aPatient().withName('Johnny', 'Smith').build(),
      ];

      mockRepository.find.mockResolvedValue(matchingPatients);

      // Act
      const result = await service.search(searchTerm);

      // Assert
      expect(result).toHaveLength(2);
      expect(mockRepository.find).toHaveBeenCalled();
    });

    it('should filter admitted patients', async () => {
      // Arrange
      const admittedPatients = [aPatient().admitted().build(), aPatient().admitted().build()];

      mockRepository.find.mockResolvedValue(admittedPatients);

      // Act
      const result = await service.findAll({ isAdmitted: true });

      // Assert
      expect(result).toHaveLength(2);
      result.forEach((patient) => {
        expect(patient.isAdmitted).toBe(true);
      });
    });
  });

  describe('Data Validation', () => {
    it('should validate required fields', async () => {
      // Arrange
      const invalidData = { firstName: 'John' }; // Missing required fields

      // Act & Assert
      await expect(service.create(invalidData as any)).rejects.toThrow();
    });

    it('should validate MRN uniqueness', async () => {
      // Arrange
      const mrn = 'MRN-20240101-1234';
      const existingPatient = aPatient().withMRN(mrn).build();

      mockRepository.findOneBy.mockResolvedValue(existingPatient);

      // Act & Assert
      await expect(service.create({ ...generatePatientDemographics(), mrn })).rejects.toThrow(
        'Patient with MRN already exists',
      );
    });

    it('should validate date of birth format', async () => {
      // Arrange
      const invalidData = generatePatientDemographics();
      invalidData.dateOfBirth = 'invalid-date';

      // Act & Assert
      await expect(service.create(invalidData)).rejects.toThrow();
    });
  });

  describe('Performance', () => {
    it('should retrieve patient by MRN within performance threshold', async () => {
      // Arrange
      const patient = aPatient().withMRN('MRN-20240101-1234').build();
      mockRepository.findOneBy.mockResolvedValue(patient);

      // Act
      const startTime = Date.now();
      await service.findByMRN('MRN-20240101-1234');
      const duration = Date.now() - startTime;

      // Assert
      expect(duration).toBeLessThan(100); // Should be < 100ms
    });
  });
});
