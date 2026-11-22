// The billing entities have stale compiled `.js` twins committed next to the
// `.ts` sources, and Jest resolves `.js` first, which breaks decorator
// evaluation. The service only uses the entity classes as repository tokens,
// so plain stand-ins are enough here.
jest.mock('../entities/insurance-claim.entity', () => ({ InsuranceClaim: class InsuranceClaim {} }));
jest.mock('../entities/insurance.entity', () => ({ Insurance: class Insurance {} }));
jest.mock('../entities/billing.entity', () => ({ Billing: class Billing {} }));

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
    save: jest.fn(),
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
      procedureCodes: [{ code: '99213', units: 1, charge: 150, diagnosisPointers: [1] }],
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

  describe('full claim lifecycle', () => {
    it('should move a claim from draft to submitted to approved and generate a patient statement', async () => {
      const createDto = {
        billingId: 'billing-123',
        insuranceId: 'insurance-123',
        patientId: 'patient-123',
        serviceStartDate: '2024-01-15',
        serviceEndDate: '2024-01-15',
        diagnosisCodes: [{ code: 'J06.9', sequence: 1 }],
        procedureCodes: [{ code: '99213', units: 1, charge: 150, diagnosisPointers: [1] }],
        provider: { npi: '1234567890', name: 'Dr. Smith', taxId: '123456789' },
        subscriber: { memberId: 'ABC123', name: 'John Doe', dob: '1980-01-01', gender: 'M' },
      };

      const mockInsurance = { id: 'insurance-123', payerName: 'BCBS' };
      const mockBilling = {
        id: 'billing-123',
        lineItems: [],
        totalCharges: 150,
        totalPayments: 0,
        totalAdjustments: 0,
        patientResponsibility: 0,
        balance: 150,
        status: 'open',
      };

      mockInsuranceRepository.findOne.mockResolvedValue(mockInsurance);
      mockBillingRepository.findOne.mockResolvedValue(mockBilling);
      mockClaimRepository.create.mockImplementation((data) => data);
      mockClaimRepository.save.mockImplementation((claim) => Promise.resolve(claim));

      const draft = await service.create(createDto);
      expect(draft.status).toBe(ClaimStatus.DRAFT);

      mockClaimRepository.findOne.mockResolvedValue(draft);
      const submitted = await service.submit({ claimId: draft.id ?? 'claim-1' });
      expect(submitted.status).toBe(ClaimStatus.PENDING);

      mockClaimRepository.findOne.mockResolvedValue(submitted);
      const approved = await service.handleAdjudicationWebhook({
        claimNumber: submitted.claimNumber,
        decision: 'approved',
        paidAmount: 120,
        allowedAmount: 130,
        patientResponsibility: 30,
      });

      expect(approved.status).toBe(ClaimStatus.APPROVED);
      expect(approved.adjudicatedAt).toBeInstanceOf(Date);
      expect(mockBillingRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ totalPayments: 120, patientResponsibility: 30, balance: 30 }),
      );
    });
  });

  describe('getClaimsDashboard', () => {
    it('should group claims by status and bucket outstanding claims by age', async () => {
      const now = Date.now();
      const mockClaims = [
        { status: ClaimStatus.APPROVED },
        { status: ClaimStatus.SUBMITTED, submittedAt: new Date(now - 10 * 86_400_000) },
        { status: ClaimStatus.PENDING, submittedAt: new Date(now - 95 * 86_400_000) },
      ];
      mockClaimRepository.find.mockResolvedValue(mockClaims);

      const result = await service.getClaimsDashboard();

      expect(result.byStatus[ClaimStatus.APPROVED]).toBe(1);
      expect(result.agingBuckets['0-30']).toBe(1);
      expect(result.agingBuckets['90+']).toBe(1);
    });
  });
  describe('handleAdjudicationWebhook', () => {
    const baseClaim = () => ({
      id: 'claim-1',
      claimNumber: 'CLM-123',
      billingId: 'billing-1',
      status: ClaimStatus.PENDING,
      payerClaimNumber: 'OLD-PAYER-NUM',
      paidAmount: 0,
      allowedAmount: 0,
      adjustmentAmount: 0,
      patientResponsibility: 0,
      submissionHistory: [{ date: '2024-01-01T00:00:00.000Z', status: 'submitted' }],
    });

    beforeEach(() => {
      mockClaimRepository.save.mockImplementation((claim) => Promise.resolve(claim));
      mockBillingRepository.save.mockImplementation((billing) => Promise.resolve(billing));
    });

    it('marks the claim APPROVED, records payer amounts and appends history', async () => {
      mockClaimRepository.findOne.mockResolvedValue(baseClaim());
      mockBillingRepository.findOne.mockResolvedValue({
        id: 'billing-1',
        totalCharges: 200,
        totalPayments: 0,
        totalAdjustments: 20,
      });

      const result = await service.handleAdjudicationWebhook({
        claimNumber: 'CLM-123',
        decision: 'approved',
        payerClaimNumber: 'PAYER-999',
        paidAmount: 150,
        allowedAmount: 180,
        adjustmentAmount: 20,
        patientResponsibility: 30,
        remarkCodes: [{ code: 'N130', description: 'Fee schedule' }],
      });

      expect(mockClaimRepository.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { claimNumber: 'CLM-123' } }),
      );
      expect(result.status).toBe(ClaimStatus.APPROVED);
      expect(result.adjudicatedAt).toBeInstanceOf(Date);
      expect(result.payerClaimNumber).toBe('PAYER-999');
      expect(result.paidAmount).toBe(150);
      expect(result.allowedAmount).toBe(180);
      expect(result.patientResponsibility).toBe(30);
      expect(result.remarkCodes).toEqual([{ code: 'N130', description: 'Fee schedule' }]);
      expect(result.submissionHistory).toHaveLength(2);
      expect(result.submissionHistory[1]).toEqual(
        expect.objectContaining({ status: ClaimStatus.APPROVED }),
      );
      expect(mockClaimRepository.save).toHaveBeenCalledWith(result);
    });

    it('generates the patient statement for the remaining balance on approval', async () => {
      mockClaimRepository.findOne.mockResolvedValue(baseClaim());
      mockBillingRepository.findOne.mockResolvedValue({
        id: 'billing-1',
        totalCharges: 200,
        totalPayments: 0,
        totalAdjustments: 20,
      });

      await service.handleAdjudicationWebhook({
        claimNumber: 'CLM-123',
        decision: 'approved',
        paidAmount: 150,
        patientResponsibility: 30,
      });

      expect(mockBillingRepository.findOne).toHaveBeenCalledWith({ where: { id: 'billing-1' } });
      expect(mockBillingRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          totalPayments: 150,
          patientResponsibility: 30,
          balance: 30,
          status: 'statement_pending',
        }),
      );
    });

    it('marks the claim REJECTED, keeps existing amounts and does not touch billing', async () => {
      mockClaimRepository.findOne.mockResolvedValue({ ...baseClaim(), paidAmount: 5 });

      const result = await service.handleAdjudicationWebhook({
        claimNumber: 'CLM-123',
        decision: 'rejected',
      });

      expect(result.status).toBe(ClaimStatus.REJECTED);
      expect(result.adjudicatedAt).toBeInstanceOf(Date);
      expect(result.paidAmount).toBe(5);
      expect(result.payerClaimNumber).toBe('OLD-PAYER-NUM');
      expect(mockBillingRepository.findOne).not.toHaveBeenCalled();
      expect(mockBillingRepository.save).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for an unknown claim number', async () => {
      mockClaimRepository.findOne.mockResolvedValue(null);

      await expect(
        service.handleAdjudicationWebhook({ claimNumber: 'CLM-NOPE', decision: 'approved' }),
      ).rejects.toThrow(NotFoundException);
      expect(mockClaimRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('submit (clearinghouse adjudication, #1079)', () => {
    const draftClaim = () => ({
      id: '1',
      claimNumber: 'CLM-123',
      status: ClaimStatus.DRAFT,
      submissionAttempts: 0,
      submissionHistory: [],
      diagnosisCodes: [{ code: 'J06.9', sequence: 1 }],
      procedureCodes: [{ code: '99213', units: 1, charge: 150, diagnosisPointers: [1] }],
      serviceStartDate: '2024-01-15',
      provider: { npi: '1234567890', name: 'Dr. Smith', taxId: '123456789' },
      subscriber: { memberId: 'ABC123', name: 'John Doe', dob: '1980-01-01', gender: 'M' },
      billedAmount: 150,
    });

    beforeEach(() => {
      mockClaimRepository.save.mockImplementation((claim) => Promise.resolve(claim));
    });

    it('marks the claim ACCEPTED when the clearinghouse accepts it', async () => {
      const claim = draftClaim();
      mockClaimRepository.findOne.mockResolvedValue(claim);
      (service as any).clearinghouseAdapter = {
        submitClaim: jest.fn().mockResolvedValue({ accepted: true, clearinghouseClaimId: 'CH-REAL' }),
      };

      const result = await service.submit({ claimId: '1' });

      expect(result.status).toBe(ClaimStatus.ACCEPTED);
      expect(result.acceptedAt).toBeInstanceOf(Date);
      expect(result.clearinghouseClaimId).toBe('CH-REAL');
    });

    it('marks the claim REJECTED and records the reason when the clearinghouse rejects it', async () => {
      mockClaimRepository.findOne.mockResolvedValue(draftClaim());
      (service as any).clearinghouseAdapter = {
        submitClaim: jest
          .fn()
          .mockResolvedValue({ accepted: false, rejectionCode: 'A7', rejectionReason: 'Invalid NPI' }),
      };

      const result = await service.submit({ claimId: '1' });

      expect(result.status).toBe(ClaimStatus.REJECTED);
      expect(result.submissionHistory[result.submissionHistory.length - 1]).toEqual(
        expect.objectContaining({ status: 'rejected', message: 'A7: Invalid NPI' }),
      );
    });

    it('marks the claim REJECTED when the clearinghouse call throws', async () => {
      mockClaimRepository.findOne.mockResolvedValue(draftClaim());
      (service as any).clearinghouseAdapter = {
        submitClaim: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      };

      const result = await service.submit({ claimId: '1' });

      expect(result.status).toBe(ClaimStatus.REJECTED);
      expect(result.submissionHistory[result.submissionHistory.length - 1].message).toContain(
        'ECONNREFUSED',
      );
    });
  });

  describe('getSubmissionReport', () => {
    it('summarises submissions and acceptance rate in the date range', async () => {
      mockClaimRepository.find.mockResolvedValue([
        { status: ClaimStatus.ACCEPTED, billedAmount: 100 },
        { status: ClaimStatus.PAID, billedAmount: '50.50' },
        { status: ClaimStatus.REJECTED, billedAmount: 25 },
        { status: ClaimStatus.PENDING, billedAmount: 10 },
      ]);

      const result = await service.getSubmissionReport('2024-01-01', '2024-01-31');

      expect(result).toEqual(
        expect.objectContaining({
          totalSubmitted: 4,
          accepted: 2,
          rejected: 1,
          pending: 1,
          acceptanceRate: 50,
          totalAmount: 185.5,
        }),
      );
    });

    it('rejects an invalid date range', async () => {
      await expect(service.getSubmissionReport('not-a-date', '2024-01-31')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.getSubmissionReport('2024-02-01', '2024-01-01')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getDenialAnalysis', () => {
    it('ranks denial reasons and totals unresolved denied amounts', async () => {
      mockClaimRepository.find.mockResolvedValue([
        {
          status: ClaimStatus.DENIED,
          billedAmount: 100,
          denials: [
            { primaryReason: 'missing_information', deniedAmount: 100, isResolved: false },
          ],
        },
        {
          status: ClaimStatus.DENIED,
          billedAmount: 80,
          denials: [
            { primaryReason: 'missing_information', deniedAmount: 80, isResolved: true },
          ],
        },
        { status: ClaimStatus.PAID, billedAmount: 200, denials: [] },
        { status: ClaimStatus.ACCEPTED, billedAmount: 50, denials: [] },
      ]);

      const result = await service.getDenialAnalysis('2024-01-01', '2024-01-31');

      expect(result.totalClaims).toBe(4);
      expect(result.totalDenials).toBe(2);
      expect(result.denialRate).toBe(50);
      expect(result.topReasons).toEqual([{ reason: 'missing_information', count: 2 }]);
      expect(result.recoveryOpportunity).toBe(100);
    });
  });
});
