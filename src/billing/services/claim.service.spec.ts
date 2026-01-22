import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClaimService } from './claim.service';
import { InsuranceClaim } from '../entities/insurance-claim.entity';
import { Insurance } from '../entities/insurance.entity';
import { Billing } from '../entities/billing.entity';
import { ClaimStatus, ClaimType } from '../../common/enums';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('ClaimService', () => {
  let service: ClaimService;
  let claimRepository: Repository<InsuranceClaim>;
  let insuranceRepository: Repository<Insurance>;
  let billingRepository: Repository<Billing>;

  const mockClaimRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    findAndCount: jest.fn(),
  };

  const mockInsuranceRepository = {
    findOne: jest.fn(),
  };

  const mockBillingRepository = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClaimService,
        {
          provide: getRepositoryToken(InsuranceClaim),
          useValue: mockClaimRepository,
        },
        {
          provide: getRepositoryToken(Insurance),
          useValue: mockInsuranceRepository,
        },
        {
          provide: getRepositoryToken(Billing),
          useValue: mockBillingRepository,
        },
      ],
    }).compile();

    service = module.get<ClaimService>(ClaimService);
    claimRepository = module.get<Repository<InsuranceClaim>>(getRepositoryToken(InsuranceClaim));
    insuranceRepository = module.get<Repository<Insurance>>(getRepositoryToken(Insurance));
    billingRepository = module.get<Repository<Billing>>(getRepositoryToken(Billing));
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto = {
      billingId: 'billing-123',
      insuranceId: 'insurance-123',
      patientId: 'patient-123',
      serviceStartDate: '2024-01-15',
      serviceEndDate: '2024-01-15',
      diagnosisCodes: [{ code: 'J06.9', sequence: 1 }],
      procedureCodes: [
        { code: '99213', units: 1, charge: 150, diagnosisPointers: [1] },
      ],
      provider: { npi: '1234567890', name: 'Dr. Smith', taxId: '123456789' },
      subscriber: { memberId: 'ABC123', name: 'John Doe', dob: '1980-01-01', gender: 'M' },
    };

    it('should create a new claim', async () => {
      const mockInsurance = { id: 'insurance-123', payerName: 'BCBS' };
      const mockBilling = { id: 'billing-123', lineItems: [] };
      const mockClaim = { id: '1', claimNumber: 'CLM-123', ...createDto };

      mockInsuranceRepository.findOne.mockResolvedValue(mockInsurance);
      mockBillingRepository.findOne.mockResolvedValue(mockBilling);
      mockClaimRepository.create.mockReturnValue(mockClaim);
      mockClaimRepository.save.mockResolvedValue(mockClaim);

      const result = await service.create(createDto);

      expect(result.claimNumber).toContain('CLM-');
      expect(mockClaimRepository.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException if insurance not found', async () => {
      mockInsuranceRepository.findOne.mockResolvedValue(null);

      await expect(service.create(createDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if billing not found', async () => {
      mockInsuranceRepository.findOne.mockResolvedValue({ id: 'insurance-123' });
      mockBillingRepository.findOne.mockResolvedValue(null);

      await expect(service.create(createDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findById', () => {
    it('should return a claim by ID', async () => {
      const mockClaim = {
        id: '1',
        claimNumber: 'CLM-123',
        status: ClaimStatus.DRAFT,
      };
      mockClaimRepository.findOne.mockResolvedValue(mockClaim);

      const result = await service.findById('1');

      expect(result).toEqual(mockClaim);
    });

    it('should throw NotFoundException if claim not found', async () => {
      mockClaimRepository.findOne.mockResolvedValue(null);

      await expect(service.findById('1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('search', () => {
    it('should return paginated claims', async () => {
      const mockClaims = [
        { id: '1', claimNumber: 'CLM-001' },
        { id: '2', claimNumber: 'CLM-002' },
      ];
      mockClaimRepository.findAndCount.mockResolvedValue([mockClaims, 2]);

      const result = await service.search({ page: 1, limit: 20 });

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should filter by status', async () => {
      mockClaimRepository.findAndCount.mockResolvedValue([[], 0]);

      await service.search({ status: ClaimStatus.PENDING });

      expect(mockClaimRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: ClaimStatus.PENDING }),
        }),
      );
    });
  });

  describe('submit', () => {
    it('should submit a draft claim', async () => {
      const mockClaim = {
        id: '1',
        claimNumber: 'CLM-123',
        status: ClaimStatus.DRAFT,
        submissionAttempts: 0,
        submissionHistory: [],
        diagnosisCodes: [{ code: 'J06.9', sequence: 1 }],
        procedureCodes: [{ code: '99213', units: 1, charge: 150, diagnosisPointers: [1] }],
        serviceStartDate: new Date(),
        provider: { npi: '1234567890', name: 'Dr. Smith', taxId: '123456789' },
        subscriber: { memberId: 'ABC123', name: 'John Doe', dob: '1980-01-01', gender: 'M' },
        billedAmount: 150,
      };

      mockClaimRepository.findOne.mockResolvedValue(mockClaim);
      mockClaimRepository.save.mockImplementation((claim) => Promise.resolve(claim));

      const result = await service.submit({ claimId: '1' });

      expect(result.status).toBe(ClaimStatus.PENDING);
      expect(result.edi837Payload).toBeDefined();
      expect(result.submissionAttempts).toBe(1);
    });

    it('should throw BadRequestException for non-draft claim', async () => {
      const mockClaim = {
        id: '1',
        status: ClaimStatus.PAID,
      };
      mockClaimRepository.findOne.mockResolvedValue(mockClaim);

      await expect(service.submit({ claimId: '1' })).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    it('should update a claim', async () => {
      const mockClaim = {
        id: '1',
        status: ClaimStatus.DRAFT,
        notes: 'Old notes',
      };

      mockClaimRepository.findOne.mockResolvedValue(mockClaim);
      mockClaimRepository.save.mockResolvedValue({ ...mockClaim, notes: 'New notes' });

      const result = await service.update('1', { notes: 'New notes' });

      expect(result.notes).toBe('New notes');
    });

    it('should throw BadRequestException for paid claim', async () => {
      const mockClaim = {
        id: '1',
        status: ClaimStatus.PAID,
      };
      mockClaimRepository.findOne.mockResolvedValue(mockClaim);

      await expect(service.update('1', { notes: 'test' })).rejects.toThrow(BadRequestException);
    });
  });

  describe('voidClaim', () => {
    it('should void a claim', async () => {
      const mockClaim = {
        id: '1',
        status: ClaimStatus.DRAFT,
        notes: '',
        submissionHistory: [],
      };

      mockClaimRepository.findOne.mockResolvedValue(mockClaim);
      mockClaimRepository.save.mockImplementation((claim) => Promise.resolve(claim));

      const result = await service.voidClaim('1', 'Duplicate claim');

      expect(result.status).toBe(ClaimStatus.VOID);
      expect(result.notes).toContain('Voided');
    });

    it('should throw BadRequestException when voiding paid claim', async () => {
      const mockClaim = { id: '1', status: ClaimStatus.PAID };
      mockClaimRepository.findOne.mockResolvedValue(mockClaim);

      await expect(service.voidClaim('1', 'reason')).rejects.toThrow(BadRequestException);
    });
  });

  describe('getPendingClaims', () => {
    it('should return pending claims', async () => {
      const mockClaims = [
        { id: '1', status: ClaimStatus.PENDING },
        { id: '2', status: ClaimStatus.SUBMITTED },
      ];
      mockClaimRepository.find.mockResolvedValue(mockClaims);

      const result = await service.getPendingClaims();

      expect(result).toHaveLength(2);
    });
  });

  describe('getClaimsByStatus', () => {
    it('should return claims by status', async () => {
      const mockClaims = [{ id: '1', status: ClaimStatus.DENIED }];
      mockClaimRepository.find.mockResolvedValue(mockClaims);

      const result = await service.getClaimsByStatus(ClaimStatus.DENIED);

      expect(result[0].status).toBe(ClaimStatus.DENIED);
    });
  });
});
