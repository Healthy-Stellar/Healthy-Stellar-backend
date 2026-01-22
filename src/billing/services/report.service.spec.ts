import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReportService } from './report.service';
import { RevenueReport } from '../entities/revenue-report.entity';
import { Billing } from '../entities/billing.entity';
import { InsuranceClaim } from '../entities/insurance-claim.entity';
import { Payment } from '../entities/payment.entity';
import { ClaimDenial } from '../entities/claim-denial.entity';
import { ReportType, PeriodType } from '../dto/report.dto';
import { ClaimStatus, PaymentStatus, DenialReason } from '../../common/enums';

describe('ReportService', () => {
  let service: ReportService;
  let reportRepository: Repository<RevenueReport>;
  let billingRepository: Repository<Billing>;
  let claimRepository: Repository<InsuranceClaim>;
  let paymentRepository: Repository<Payment>;
  let denialRepository: Repository<ClaimDenial>;

  const mockReportRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
  };

  const mockBillingRepository = {
    find: jest.fn(),
  };

  const mockClaimRepository = {
    find: jest.fn(),
  };

  const mockPaymentRepository = {
    find: jest.fn(),
  };

  const mockDenialRepository = {
    find: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportService,
        {
          provide: getRepositoryToken(RevenueReport),
          useValue: mockReportRepository,
        },
        {
          provide: getRepositoryToken(Billing),
          useValue: mockBillingRepository,
        },
        {
          provide: getRepositoryToken(InsuranceClaim),
          useValue: mockClaimRepository,
        },
        {
          provide: getRepositoryToken(Payment),
          useValue: mockPaymentRepository,
        },
        {
          provide: getRepositoryToken(ClaimDenial),
          useValue: mockDenialRepository,
        },
      ],
    }).compile();

    service = module.get<ReportService>(ReportService);
    reportRepository = module.get<Repository<RevenueReport>>(getRepositoryToken(RevenueReport));
    billingRepository = module.get<Repository<Billing>>(getRepositoryToken(Billing));
    claimRepository = module.get<Repository<InsuranceClaim>>(getRepositoryToken(InsuranceClaim));
    paymentRepository = module.get<Repository<Payment>>(getRepositoryToken(Payment));
    denialRepository = module.get<Repository<ClaimDenial>>(getRepositoryToken(ClaimDenial));
    jest.clearAllMocks();
  });

  describe('generateReport', () => {
    const generateDto = {
      reportType: ReportType.REVENUE_SUMMARY,
      periodType: PeriodType.MONTHLY,
      periodStart: '2024-01-01',
      periodEnd: '2024-01-31',
    };

    it('should generate a revenue report', async () => {
      const mockBillings = [
        {
          totalCharges: 1000,
          totalAdjustments: 100,
          balance: 200,
          providerId: 'prov-1',
          providerName: 'Dr. Smith',
          totalPayments: 700,
          lineItems: [{ cptCode: '99213', cptDescription: 'Office visit', totalCharge: 150, paidAmount: 100 }],
        },
      ];
      const mockClaims = [
        {
          status: ClaimStatus.PAID,
          billedAmount: 1000,
          paidAmount: 800,
          submissionAttempts: 1,
          submittedAt: new Date(),
          adjudicatedAt: new Date(),
          insurance: { payerName: 'BCBS', payerType: 'commercial' },
        },
      ];
      const mockPayments = [
        { amount: 800, status: PaymentStatus.COMPLETED },
      ];
      const mockDenials = [
        { primaryReason: DenialReason.NOT_MEDICALLY_NECESSARY, deniedAmount: 200 },
      ];

      mockBillingRepository.find.mockResolvedValue(mockBillings);
      mockClaimRepository.find.mockResolvedValue(mockClaims);
      mockPaymentRepository.find.mockResolvedValue(mockPayments);
      mockDenialRepository.find.mockResolvedValue(mockDenials);

      const mockReport = {
        reportType: generateDto.reportType,
        periodType: generateDto.periodType,
        totalCharges: 1000,
        totalPayments: 800,
        claimsSubmitted: 1,
        claimsPaid: 1,
      };
      mockReportRepository.create.mockReturnValue(mockReport);
      mockReportRepository.save.mockResolvedValue(mockReport);

      const result = await service.generateReport(generateDto);

      expect(result.totalCharges).toBe(1000);
      expect(result.totalPayments).toBe(800);
      expect(result.claimsSubmitted).toBe(1);
      expect(result.claimsPaid).toBe(1);
    });
  });

  describe('getARAgingReport', () => {
    it('should return AR aging breakdown', async () => {
      const mockBillings = [
        { id: '1', patientId: 'p1', invoiceNumber: 'INV-001', serviceDate: new Date(), balance: 100 },
        { id: '2', patientId: 'p2', invoiceNumber: 'INV-002', serviceDate: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000), balance: 200 },
        { id: '3', patientId: 'p3', invoiceNumber: 'INV-003', serviceDate: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000), balance: 300 },
      ];
      mockBillingRepository.find.mockResolvedValue(mockBillings);

      const result = await service.getARAgingReport({ asOfDate: new Date().toISOString() });

      expect(result.summary.total).toBe(600);
      expect(result.details).toHaveLength(3);
    });
  });

  describe('getDenialAnalysisReport', () => {
    it('should return denial analysis', async () => {
      const mockDenials = [
        {
          primaryReason: DenialReason.NOT_MEDICALLY_NECESSARY,
          deniedAmount: 500,
          denialDate: new Date('2024-01-15'),
          claim: { insurance: { payerName: 'BCBS' } },
          appeals: [],
          isResolved: false,
        },
        {
          primaryReason: DenialReason.COVERAGE_TERMINATED,
          deniedAmount: 300,
          denialDate: new Date('2024-01-20'),
          claim: { insurance: { payerName: 'Aetna' } },
          appeals: [],
          isResolved: true,
          resolutionType: 'appeal_approved',
          recoveredAmount: 300,
        },
      ];
      mockDenialRepository.find.mockResolvedValue(mockDenials);

      const result = await service.getDenialAnalysisReport({
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      });

      expect(result.summary.totalDenials).toBe(2);
      expect(result.summary.totalDeniedAmount).toBe(800);
      expect(result.byReason).toHaveLength(2);
      expect(result.byPayer).toHaveLength(2);
    });
  });

  describe('getReportHistory', () => {
    it('should return report history', async () => {
      const mockReports = [
        { id: 'r1', reportType: ReportType.REVENUE_SUMMARY, generatedAt: new Date() },
        { id: 'r2', reportType: ReportType.AR_AGING, generatedAt: new Date() },
      ];
      mockReportRepository.find.mockResolvedValue(mockReports);

      const result = await service.getReportHistory({});

      expect(result).toHaveLength(2);
    });

    it('should filter by report type', async () => {
      mockReportRepository.find.mockResolvedValue([]);

      await service.getReportHistory({ reportType: ReportType.DENIAL_ANALYSIS });

      expect(mockReportRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ reportType: ReportType.DENIAL_ANALYSIS }),
        }),
      );
    });
  });
});
