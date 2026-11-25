import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import { ComplianceReportsService } from './compliance-reports.service';
import { ComplianceReportJob, ComplianceReportStatus, ComplianceReportType } from '../entities/compliance-report-job.entity';
import { AuditLogEntity, AuditAction } from '../../common/audit/audit-log.entity';
import { AuditService } from '../../common/audit/audit.service';
import { QUEUE_NAMES } from '../../queues/queue.constants';

jest.mock('fs', () => ({
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  existsSync: jest.fn().mockReturnValue(true),
  readFileSync: jest.fn().mockReturnValue(Buffer.from('file-contents')),
}));

describe('ComplianceReportsService', () => {
  let service: ComplianceReportsService;

  const mockJobRepository = {
    create: jest.fn((data) => data),
    save: jest.fn(),
    findOne: jest.fn(),
  };

  const mockAuditLogRepository = {
    find: jest.fn().mockResolvedValue([]),
    createQueryBuilder: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    }),
  };

  const mockQueue = { add: jest.fn() };
  const mockAuditService = { log: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ComplianceReportsService,
        { provide: getRepositoryToken(ComplianceReportJob), useValue: mockJobRepository },
        { provide: getRepositoryToken(AuditLogEntity), useValue: mockAuditLogRepository },
        { provide: getQueueToken(QUEUE_NAMES.COMPLIANCE_REPORTS), useValue: mockQueue },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get(ComplianceReportsService);
    jest.clearAllMocks();
  });

  describe('requestReport', () => {
    it('creates a pending job and enqueues a generation job', async () => {
      const job = { id: 'job-1', status: ComplianceReportStatus.PENDING };
      mockJobRepository.save.mockResolvedValue(job);

      const result = await service.requestReport(
        { startDate: '2024-01-01', endDate: '2024-01-31', reportType: ComplianceReportType.HIPAA },
        'user-1',
        'tenant-a',
      );

      expect(result).toEqual({ jobId: 'job-1', status: ComplianceReportStatus.PENDING });
      expect(mockQueue.add).toHaveBeenCalledWith('generate-compliance-report', { jobId: 'job-1' });
      expect(mockAuditService.log).toHaveBeenCalled();
    });

    it('rejects when startDate is after endDate', async () => {
      await expect(
        service.requestReport(
          { startDate: '2024-02-01', endDate: '2024-01-01', reportType: ComplianceReportType.GDPR },
          'user-1',
          'tenant-a',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getJob', () => {
    it('throws NotFoundException when missing', async () => {
      mockJobRepository.findOne.mockResolvedValue(null);
      await expect(service.getJob('missing', 'tenant-a')).rejects.toThrow(NotFoundException);
    });
  });

  describe('process', () => {
    it('builds the report, stores summary counts, and marks the job completed', async () => {
      const job = {
        id: 'job-1',
        reportType: ComplianceReportType.SOC2,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        status: ComplianceReportStatus.PENDING,
        requestedByUserId: 'user-1',
      };
      mockJobRepository.findOne.mockResolvedValue(job);
      mockJobRepository.save.mockImplementation((j) => Promise.resolve(j));
      mockAuditLogRepository.createQueryBuilder().getMany
        .mockResolvedValueOnce([{ action: AuditAction.DATA_ACCESS, timestamp: new Date(), userId: 'u1' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await service.process('job-1');

      expect(job.status).toBe(ComplianceReportStatus.COMPLETED);
      expect((job as any).summary.accessLogCount).toBe(1);
      expect(fs.writeFileSync).toHaveBeenCalledTimes(2);
    });

    it('completes a job loaded from the repository with `date` columns hydrated as strings', async () => {
      // TypeORM's Postgres driver returns `date` columns as 'YYYY-MM-DD' strings.
      const job = {
        id: 'job-2',
        reportType: ComplianceReportType.HIPAA,
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        status: ComplianceReportStatus.PENDING,
        requestedByUserId: 'user-1',
      };
      mockJobRepository.findOne.mockResolvedValue(job);
      mockJobRepository.save.mockImplementation((j) => Promise.resolve(j));
      mockAuditLogRepository.find.mockResolvedValue([]);
      const queryBuilder = mockAuditLogRepository.createQueryBuilder();

      await service.process('job-2');

      expect((job as any).errorDetails).toBeUndefined();
      expect(job.status).toBe(ComplianceReportStatus.COMPLETED);

      // End of range is inclusive: entries are collected up to (but excluding) endDate + 1 day.
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'audit.timestamp >= :start AND audit.timestamp < :end',
        {
          start: new Date('2024-01-01T00:00:00.000Z'),
          end: new Date('2024-02-01T00:00:00.000Z'),
        },
      );
    });
  });

  describe('download', () => {
    it('rejects when the report is not completed yet', async () => {
      mockJobRepository.findOne.mockResolvedValue({ id: 'job-1', status: ComplianceReportStatus.PROCESSING });
      await expect(service.download('job-1', 'pdf', 'tenant-a')).rejects.toThrow(BadRequestException);
    });

    it('returns the file buffer and increments downloadCount', async () => {
      const job = {
        id: 'job-1',
        status: ComplianceReportStatus.COMPLETED,
        pdfPath: '/tmp/job-1.pdf',
        downloadCount: 0,
      };
      mockJobRepository.findOne.mockResolvedValue(job);
      mockJobRepository.save.mockImplementation((j) => Promise.resolve(j));

      const buffer = await service.download('job-1', 'pdf', 'tenant-a', 'user-1');

      expect(buffer.toString()).toBe('file-contents');
      expect(job.downloadCount).toBe(1);
      expect(mockAuditService.log).toHaveBeenCalled();
    });
  });
});
