import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from './reports.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ReportJob, ReportFormat, ReportStatus } from './entities/report-job.entity';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from '../notifications/services/notifications.service';
import { EntityManager } from 'typeorm';
import { I18nService } from '../i18n/i18n.service';
import * as ExcelJS from 'exceljs';

jest.mock(
  'ipfs-http-client',
  () => ({
    create: jest.fn().mockReturnValue({
      add: jest.fn().mockResolvedValue({ path: 'mock-hash' }),
      cat: jest.fn(),
    }),
  }),
  { virtual: true },
);

describe('ReportsService', () => {
  let service: ReportsService;
  let mockReportJobRepo;
  let mockEntityManager;
  let mockConfigService;
  let mockNotificationsService;
  let mockI18nService;

  beforeEach(async () => {
    mockReportJobRepo = {
      create: jest.fn().mockImplementation((dto) => ({ id: 'mock-job-id', ...dto })),
      save: jest.fn().mockResolvedValue({ id: 'mock-job-id' }),
      findOne: jest.fn(),
      update: jest.fn(),
    };

    mockEntityManager = {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
    };

    mockConfigService = {
      get: jest.fn().mockReturnValue('http://localhost:3000'),
    };

    mockNotificationsService = {
      sendEmail: jest.fn(),
    };

    mockI18nService = {
      isRtlLocale: jest.fn().mockReturnValue(false),
      formatDate: jest.fn().mockReturnValue('2026-01-01'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        {
          provide: getRepositoryToken(ReportJob),
          useValue: mockReportJobRepo,
        },
        {
          provide: EntityManager,
          useValue: mockEntityManager,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
        {
          provide: I18nService,
          useValue: mockI18nService,
        },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);

    // Silence the background logger during tests
    jest.spyOn(service['logger'], 'error').mockImplementation(() => {});
    jest.spyOn(service['logger'], 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('requestReport', () => {
    it('should create and save a new PENDING job', async () => {
      const result = await service.requestReport('patient-123', ReportFormat.CSV);

      expect(mockReportJobRepo.create).toHaveBeenCalledWith({
        patientId: 'patient-123',
        format: ReportFormat.CSV,
        status: ReportStatus.PENDING,
      });
      expect(mockReportJobRepo.save).toHaveBeenCalled();
      expect(result).toHaveProperty('jobId', 'mock-job-id');
      expect(result).toHaveProperty('estimatedTime');
    });
  });

  describe('getJobStatus', () => {
    it('should return not found if job does not exist', async () => {
      mockReportJobRepo.findOne.mockResolvedValue(null);
      await expect(service.getJobStatus('job-1', 'patient-123')).rejects.toThrow(
        'Report job not found',
      );
    });

    it('should return status only if not completed', async () => {
      mockReportJobRepo.findOne.mockResolvedValue({ id: 'job-1', status: ReportStatus.PROCESSING });
      const result = await service.getJobStatus('job-1', 'patient-123');
      expect(result).toEqual({ status: ReportStatus.PROCESSING });
    });

    it('should return download url if completed and not expired', async () => {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 1); // future

      mockReportJobRepo.findOne.mockResolvedValue({
        id: 'job-1',
        status: ReportStatus.COMPLETED,
        downloadToken: 'xyz-token',
        expiresAt,
      });

      const result = await service.getJobStatus('job-1', 'patient-123');
      expect(result).toHaveProperty('status', ReportStatus.COMPLETED);
      expect(result).toHaveProperty('downloadUrl');
      expect(result.downloadUrl).toContain('token=xyz-token');
    });

    it('should throw error if completed but expired', async () => {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() - 1); // past

      mockReportJobRepo.findOne.mockResolvedValue({
        id: 'job-1',
        status: ReportStatus.COMPLETED,
        downloadToken: 'xyz-token',
        expiresAt,
      });

      await expect(service.getJobStatus('job-1', 'patient-123')).rejects.toThrow(
        'Download link has expired',
      );
    });
  });

  describe('generateXlsxBuffer (XLSX export)', () => {
    const patient = { id: 'patient-123', firstName: 'Jane', lastName: 'Doe' } as any;

    const records = [
      {
        createdAt: new Date('2026-01-05T10:00:00Z'),
        recordType: 'consultation',
        title: 'Annual Checkup',
        metadata: { transactionHash: '0xabc' },
      },
    ] as any[];

    const grants = [
      {
        granteeId: 'dr-smith',
        status: 'ACTIVE',
        accessLevel: 'READ',
        expiresAt: new Date('2026-06-01T00:00:00Z'),
        sorobanTxHash: '0xdef',
      },
    ] as any[];

    const logs = [
      {
        timestamp: new Date('2026-01-06T12:00:00Z'),
        action: 'DATA_ACCESS',
        description: 'Viewed record',
        details: { transactionHash: '0xghi' },
      },
    ] as any[];

    const billings = [
      {
        invoiceNumber: 'INV-001',
        serviceDate: new Date('2026-01-04T00:00:00Z'),
        providerName: 'Dr. Smith',
        totalCharges: 250.5,
        totalPayments: 200,
        balance: 50.5,
        status: 'open',
        dueDate: new Date('2026-02-04T00:00:00Z'),
      },
    ] as any[];

    it('generates a multi-sheet workbook with the expected sheet names and columns', async () => {
      const buffer = await service['generateXlsxBuffer'](patient, records, grants, logs, billings);

      expect(Buffer.isBuffer(buffer)).toBe(true);

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);

      const sheetNames = workbook.worksheets.map((ws) => ws.name);
      expect(sheetNames).toEqual([
        'Summary',
        'Medical Records',
        'Access Grants',
        'Audit Logs',
        'Billing Summary',
      ]);

      const recordsSheet = workbook.getWorksheet('Medical Records');
      expect(recordsSheet.getRow(1).values.slice(1)).toEqual([
        'Date',
        'Type',
        'Title',
        'Transaction Hash',
      ]);
      expect(recordsSheet.getRow(2).getCell(1).value).toBeInstanceOf(Date);

      const billingSheet = workbook.getWorksheet('Billing Summary');
      expect(billingSheet.getRow(1).values.slice(1)).toEqual([
        'Invoice Number',
        'Service Date',
        'Provider',
        'Total Charges',
        'Total Payments',
        'Balance',
        'Status',
        'Due Date',
      ]);

      // Currency and date columns should carry native Excel number formats,
      // not just be stringified in the cell value.
      expect(billingSheet.getColumn('totalCharges' as any).numFmt).toBe('"$"#,##0.00');
      expect(billingSheet.getColumn('serviceDate' as any).numFmt).toBe('yyyy-mm-dd');
      expect(billingSheet.getRow(2).getCell(4).value).toBe(250.5);
    });
  });
});
