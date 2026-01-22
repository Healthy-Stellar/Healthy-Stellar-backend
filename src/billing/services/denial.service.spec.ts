import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DenialService } from './denial.service';
import { ClaimDenial } from '../entities/claim-denial.entity';
import { ClaimAppeal } from '../entities/claim-appeal.entity';
import { InsuranceClaim } from '../entities/insurance-claim.entity';
import { DenialReason, AppealStatus, ClaimStatus } from '../../common/enums';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('DenialService', () => {
  let service: DenialService;
  let denialRepository: Repository<ClaimDenial>;
  let appealRepository: Repository<ClaimAppeal>;
  let claimRepository: Repository<InsuranceClaim>;

  const mockDenialRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    findAndCount: jest.fn(),
  };

  const mockAppealRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    findAndCount: jest.fn(),
  };

  const mockClaimRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DenialService,
        {
          provide: getRepositoryToken(ClaimDenial),
          useValue: mockDenialRepository,
        },
        {
          provide: getRepositoryToken(ClaimAppeal),
          useValue: mockAppealRepository,
        },
        {
          provide: getRepositoryToken(InsuranceClaim),
          useValue: mockClaimRepository,
        },
      ],
    }).compile();

    service = module.get<DenialService>(DenialService);
    denialRepository = module.get<Repository<ClaimDenial>>(getRepositoryToken(ClaimDenial));
    appealRepository = module.get<Repository<ClaimAppeal>>(getRepositoryToken(ClaimAppeal));
    claimRepository = module.get<Repository<InsuranceClaim>>(getRepositoryToken(InsuranceClaim));
    jest.clearAllMocks();
  });

  describe('createDenial', () => {
    const createDto = {
      claimId: 'claim-123',
      denialDate: '2024-01-15',
      primaryReason: DenialReason.NOT_MEDICALLY_NECESSARY,
      deniedAmount: 500,
    };

    it('should create a denial record', async () => {
      const mockClaim = { id: 'claim-123', status: ClaimStatus.PENDING };
      const mockDenial = { id: 'den-1', denialNumber: 'DEN-123', ...createDto };

      mockClaimRepository.findOne.mockResolvedValue(mockClaim);
      mockDenialRepository.create.mockReturnValue(mockDenial);
      mockDenialRepository.save.mockResolvedValue(mockDenial);
      mockClaimRepository.save.mockResolvedValue({ ...mockClaim, status: ClaimStatus.DENIED });

      const result = await service.createDenial(createDto);

      expect(result.denialNumber).toContain('DEN-');
      expect(mockClaimRepository.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if claim not found', async () => {
      mockClaimRepository.findOne.mockResolvedValue(null);

      await expect(service.createDenial(createDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findDenialById', () => {
    it('should return a denial by ID', async () => {
      const mockDenial = {
        id: 'den-1',
        denialNumber: 'DEN-123',
        primaryReason: DenialReason.NOT_MEDICALLY_NECESSARY,
      };
      mockDenialRepository.findOne.mockResolvedValue(mockDenial);

      const result = await service.findDenialById('den-1');

      expect(result).toEqual(mockDenial);
    });

    it('should throw NotFoundException if denial not found', async () => {
      mockDenialRepository.findOne.mockResolvedValue(null);

      await expect(service.findDenialById('den-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createAppeal', () => {
    const createDto = {
      denialId: 'den-123',
      appealReason: 'Medical necessity documentation attached',
      appealedAmount: 500,
    };

    it('should create an appeal', async () => {
      const mockDenial = {
        id: 'den-123',
        claimId: 'claim-123',
        isAppealable: true,
        appealDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      };
      const mockAppeal = {
        id: 'apl-1',
        appealNumber: 'APL-test-uuid-1234',
        denialId: 'den-123',
        claimId: 'claim-123',
        appealLevel: 1,
        status: AppealStatus.DRAFT,
        appealReason: createDto.appealReason,
        appealedAmount: createDto.appealedAmount,
        timeline: [{ date: expect.any(String), action: 'Appeal created', notes: 'Initial appeal draft created' }],
      };

      mockDenialRepository.findOne.mockResolvedValue(mockDenial);
      mockAppealRepository.find.mockResolvedValue([]);
      mockAppealRepository.create.mockReturnValue(mockAppeal);
      mockAppealRepository.save.mockResolvedValue(mockAppeal);

      const result = await service.createAppeal(createDto);

      expect(result.appealNumber).toBeDefined();
      expect(result.appealLevel).toBe(1);
    });

    it('should throw BadRequestException if denial is not appealable', async () => {
      const mockDenial = { id: 'den-123', isAppealable: false };
      mockDenialRepository.findOne.mockResolvedValue(mockDenial);

      await expect(service.createAppeal(createDto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if deadline passed', async () => {
      const mockDenial = {
        id: 'den-123',
        isAppealable: true,
        appealDeadline: new Date('2020-01-01'),
      };
      mockDenialRepository.findOne.mockResolvedValue(mockDenial);

      await expect(service.createAppeal(createDto)).rejects.toThrow(BadRequestException);
    });

    it('should increment appeal level for subsequent appeals', async () => {
      const mockDenial = {
        id: 'den-123',
        claimId: 'claim-123',
        isAppealable: true,
        appealDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      };
      const existingAppeals = [{ appealLevel: 1 }];
      const mockAppeal = { id: 'apl-2', appealNumber: 'APL-456', ...createDto, appealLevel: 2 };

      mockDenialRepository.findOne.mockResolvedValue(mockDenial);
      mockAppealRepository.find.mockResolvedValue(existingAppeals);
      mockAppealRepository.create.mockReturnValue(mockAppeal);
      mockAppealRepository.save.mockResolvedValue(mockAppeal);

      const result = await service.createAppeal(createDto);

      expect(result.appealLevel).toBe(2);
    });
  });

  describe('submitAppeal', () => {
    it('should submit a draft appeal', async () => {
      const mockAppeal = {
        id: 'apl-1',
        denialId: 'den-123',
        status: AppealStatus.DRAFT,
        timeline: [],
      };
      const mockDenial = { id: 'den-123', claimId: 'claim-123' };
      const mockClaim = { id: 'claim-123', status: ClaimStatus.DENIED };

      mockAppealRepository.findOne.mockResolvedValue(mockAppeal);
      mockAppealRepository.save.mockImplementation((appeal) => Promise.resolve(appeal));
      mockDenialRepository.findOne.mockResolvedValue(mockDenial);
      mockClaimRepository.findOne.mockResolvedValue(mockClaim);
      mockClaimRepository.save.mockResolvedValue({ ...mockClaim, status: ClaimStatus.APPEALED });

      const result = await service.submitAppeal('apl-1');

      expect(result.status).toBe(AppealStatus.SUBMITTED);
      expect(result.submittedDate).toBeDefined();
    });

    it('should throw BadRequestException for non-draft appeal', async () => {
      const mockAppeal = { id: 'apl-1', status: AppealStatus.SUBMITTED };
      mockAppealRepository.findOne.mockResolvedValue(mockAppeal);

      await expect(service.submitAppeal('apl-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('processAppealDecision', () => {
    it('should process approved appeal', async () => {
      const mockAppeal = {
        id: 'apl-1',
        denialId: 'den-123',
        status: AppealStatus.SUBMITTED,
        timeline: [],
      };
      const mockDenial = {
        id: 'den-123',
        claimId: 'claim-123',
        deniedAmount: 500,
        isResolved: false,
      };
      const mockClaim = { id: 'claim-123', status: ClaimStatus.APPEALED, paidAmount: 0 };

      mockAppealRepository.findOne.mockResolvedValue(mockAppeal);
      mockAppealRepository.save.mockImplementation((appeal) => Promise.resolve(appeal));
      mockDenialRepository.findOne.mockResolvedValue(mockDenial);
      mockDenialRepository.save.mockResolvedValue(mockDenial);
      mockClaimRepository.findOne.mockResolvedValue(mockClaim);
      mockClaimRepository.save.mockResolvedValue(mockClaim);

      const result = await service.processAppealDecision('apl-1', {
        approved: true,
        approvedAmount: 500,
        payerResponse: 'Appeal approved based on documentation',
      });

      expect(result.status).toBe(AppealStatus.APPROVED);
      expect(result.approvedAmount).toBe(500);
    });

    it('should process denied appeal', async () => {
      const mockAppeal = {
        id: 'apl-1',
        denialId: 'den-123',
        status: AppealStatus.SUBMITTED,
        timeline: [],
      };
      const mockDenial = { id: 'den-123', claimId: 'claim-123' };

      mockAppealRepository.findOne.mockResolvedValue(mockAppeal);
      mockAppealRepository.save.mockImplementation((appeal) => Promise.resolve(appeal));
      mockDenialRepository.findOne.mockResolvedValue(mockDenial);

      const result = await service.processAppealDecision('apl-1', {
        approved: false,
        payerResponse: 'Appeal denied - insufficient documentation',
      });

      expect(result.status).toBe(AppealStatus.DENIED);
    });
  });

  describe('getDenialAnalytics', () => {
    it('should return denial analytics', async () => {
      const mockDenials = [
        {
          primaryReason: DenialReason.NOT_MEDICALLY_NECESSARY,
          deniedAmount: 500,
          appeals: [],
        },
        {
          primaryReason: DenialReason.NOT_MEDICALLY_NECESSARY,
          deniedAmount: 300,
          appeals: [{ status: AppealStatus.APPROVED, approvedAmount: 300 }],
        },
      ];
      mockDenialRepository.find.mockResolvedValue(mockDenials);

      const result = await service.getDenialAnalytics(
        new Date('2024-01-01'),
        new Date('2024-12-31'),
      );

      expect(result.totalDenials).toBe(2);
      expect(result.totalDeniedAmount).toBe(800);
      expect(result.appealRate).toBe(50);
      expect(result.overturnRate).toBe(100);
    });
  });

  describe('getUpcomingDeadlines', () => {
    it('should return denials with upcoming deadlines', async () => {
      const mockDenials = [
        { id: 'den-1', appealDeadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000) },
        { id: 'den-2', appealDeadline: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000) },
      ];
      mockDenialRepository.find.mockResolvedValue(mockDenials);

      const result = await service.getUpcomingDeadlines(30);

      expect(result).toHaveLength(2);
    });
  });
});
