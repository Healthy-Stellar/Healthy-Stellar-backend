import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InsuranceService } from './insurance.service';
import { Insurance } from '../entities/insurance.entity';
import { InsuranceVerification } from '../entities/insurance-verification.entity';
import { InsuranceType, PayerType, VerificationStatus } from '../../common/enums';
import { NotFoundException } from '@nestjs/common';

describe('InsuranceService', () => {
  let service: InsuranceService;
  let insuranceRepository: Repository<Insurance>;
  let verificationRepository: Repository<InsuranceVerification>;

  const mockInsuranceRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    remove: jest.fn(),
  };

  const mockVerificationRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InsuranceService,
        {
          provide: getRepositoryToken(Insurance),
          useValue: mockInsuranceRepository,
        },
        {
          provide: getRepositoryToken(InsuranceVerification),
          useValue: mockVerificationRepository,
        },
      ],
    }).compile();

    service = module.get<InsuranceService>(InsuranceService);
    insuranceRepository = module.get<Repository<Insurance>>(getRepositoryToken(Insurance));
    verificationRepository = module.get<Repository<InsuranceVerification>>(
      getRepositoryToken(InsuranceVerification),
    );
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto = {
      patientId: 'patient-123',
      payerName: 'Blue Cross Blue Shield',
      payerId: 'BCBS001',
      memberId: 'ABC123456789',
      subscriberName: 'John Doe',
      subscriberRelationship: 'self',
      effectiveDate: '2024-01-01',
    };

    it('should create a new insurance record', async () => {
      const mockInsurance = { id: '1', ...createDto };
      mockInsuranceRepository.create.mockReturnValue(mockInsurance);
      mockInsuranceRepository.save.mockResolvedValue(mockInsurance);

      const result = await service.create(createDto);

      expect(result).toEqual(mockInsurance);
      expect(mockInsuranceRepository.create).toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('should return an insurance by ID', async () => {
      const mockInsurance = {
        id: '1',
        patientId: 'patient-123',
        payerName: 'BCBS',
      };
      mockInsuranceRepository.findOne.mockResolvedValue(mockInsurance);

      const result = await service.findById('1');

      expect(result).toEqual(mockInsurance);
    });

    it('should throw NotFoundException if insurance not found', async () => {
      mockInsuranceRepository.findOne.mockResolvedValue(null);

      await expect(service.findById('1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByPatientId', () => {
    it('should return all active insurance for a patient', async () => {
      const mockInsurances = [
        { id: '1', patientId: 'patient-123', insuranceType: InsuranceType.PRIMARY },
        { id: '2', patientId: 'patient-123', insuranceType: InsuranceType.SECONDARY },
      ];
      mockInsuranceRepository.find.mockResolvedValue(mockInsurances);

      const result = await service.findByPatientId('patient-123');

      expect(result).toEqual(mockInsurances);
      expect(result).toHaveLength(2);
    });
  });

  describe('update', () => {
    it('should update an insurance record', async () => {
      const existingInsurance = {
        id: '1',
        patientId: 'patient-123',
        payerName: 'Old Payer',
        effectiveDate: new Date('2024-01-01'),
      };
      const updatedInsurance = { ...existingInsurance, payerName: 'New Payer' };

      mockInsuranceRepository.findOne.mockResolvedValue(existingInsurance);
      mockInsuranceRepository.save.mockResolvedValue(updatedInsurance);

      const result = await service.update('1', { payerName: 'New Payer' });

      expect(result.payerName).toBe('New Payer');
    });
  });

  describe('verifyEligibility', () => {
    it('should verify insurance eligibility', async () => {
      const mockInsurance = {
        id: '1',
        patientId: 'patient-123',
        effectiveDate: new Date('2024-01-01'),
        terminationDate: null,
        deductible: 1500,
        deductibleMet: 500,
        copay: 25,
        coinsurancePercentage: 20,
        outOfPocketMax: 6000,
        outOfPocketMet: 1000,
      };
      const mockVerification = {
        id: 'ver-1',
        insuranceId: '1',
        status: VerificationStatus.VERIFIED,
        isEligible: true,
      };

      mockInsuranceRepository.findOne.mockResolvedValue(mockInsurance);
      mockVerificationRepository.create.mockReturnValue(mockVerification);
      mockVerificationRepository.save.mockResolvedValue(mockVerification);
      mockInsuranceRepository.save.mockResolvedValue(mockInsurance);

      const result = await service.verifyEligibility({ insuranceId: '1' });

      expect(result.isEligible).toBe(true);
      expect(result.status).toBe(VerificationStatus.VERIFIED);
    });

    it('should return not eligible for terminated coverage', async () => {
      const mockInsurance = {
        id: '1',
        patientId: 'patient-123',
        effectiveDate: new Date('2023-01-01'),
        terminationDate: new Date('2023-12-31'),
      };
      const mockVerification = {
        id: 'ver-1',
        insuranceId: '1',
        status: VerificationStatus.FAILED,
        isEligible: false,
      };

      mockInsuranceRepository.findOne.mockResolvedValue(mockInsurance);
      mockVerificationRepository.create.mockReturnValue(mockVerification);
      mockVerificationRepository.save.mockResolvedValue(mockVerification);
      mockInsuranceRepository.save.mockResolvedValue(mockInsurance);

      const result = await service.verifyEligibility({ insuranceId: '1' });

      expect(result.isEligible).toBe(false);
    });
  });

  describe('requestAuthorization', () => {
    it('should request prior authorization', async () => {
      const mockInsurance = { id: '1', patientId: 'patient-123' };
      const mockVerification = {
        id: 'ver-1',
        insuranceId: '1',
        authorizationNumber: 'AUTH-12345678',
      };

      mockInsuranceRepository.findOne.mockResolvedValue(mockInsurance);
      mockVerificationRepository.create.mockReturnValue(mockVerification);
      mockVerificationRepository.save.mockResolvedValue(mockVerification);

      const result = await service.requestAuthorization({
        insuranceId: '1',
        procedureCodes: ['27447'],
        diagnosisCodes: ['M17.11'],
        serviceStartDate: '2024-03-01',
      });

      expect(result.authorizationNumber).toBeDefined();
    });
  });

  describe('getVerificationHistory', () => {
    it('should return verification history', async () => {
      const mockVerifications = [
        { id: 'ver-1', insuranceId: '1', status: VerificationStatus.VERIFIED },
        { id: 'ver-2', insuranceId: '1', status: VerificationStatus.VERIFIED },
      ];
      mockVerificationRepository.find.mockResolvedValue(mockVerifications);

      const result = await service.getVerificationHistory('1');

      expect(result).toHaveLength(2);
    });
  });

  describe('deactivate', () => {
    it('should deactivate an insurance record', async () => {
      const mockInsurance = { id: '1', isActive: true };
      mockInsuranceRepository.findOne.mockResolvedValue(mockInsurance);
      mockInsuranceRepository.save.mockResolvedValue({ ...mockInsurance, isActive: false });

      const result = await service.deactivate('1');

      expect(result.isActive).toBe(false);
    });
  });
});
