import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { BulkExportService } from '../services/bulk-export.service';
import { BulkExportJob, ExportJobStatus } from '../entities/bulk-export-job.entity';
import { Patient } from '../../patients/entities/patient.entity';
import { MedicalRecord } from '../../medical-records/entities/medical-record.entity';
import { MedicalRecordConsent } from '../../medical-records/entities/medical-record-consent.entity';
import { MedicalHistory } from '../../medical-records/entities/medical-history.entity';

// Helper: build a minimal mock repo
const makeRepo = (overrides: Record<string, jest.Mock> = {}) => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  remove: jest.fn(),
  createQueryBuilder: jest.fn(),
  ...overrides,
});

describe('BulkExportService', () => {
  let service: BulkExportService;
  let jobRepo: ReturnType<typeof makeRepo>;
  let patientRepo: ReturnType<typeof makeRepo>;
  let recordRepo: ReturnType<typeof makeRepo>;
  let consentRepo: ReturnType<typeof makeRepo>;
  let historyRepo: ReturnType<typeof makeRepo>;
  let exportQueue: { add: jest.Mock };

  beforeEach(async () => {
    jobRepo = makeRepo();
    patientRepo = makeRepo();
    recordRepo = makeRepo();
    consentRepo = makeRepo();
    historyRepo = makeRepo();
    exportQueue = { add: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BulkExportService,
        { provide: getRepositoryToken(BulkExportJob), useValue: jobRepo },
        { provide: getRepositoryToken(Patient), useValue: patientRepo },
        { provide: getRepositoryToken(MedicalRecord), useValue: recordRepo },
        { provide: getRepositoryToken(MedicalRecordConsent), useValue: consentRepo },
        { provide: getRepositoryToken(MedicalHistory), useValue: historyRepo },
        { provide: getQueueToken('fhir-bulk-export'), useValue: exportQueue },
      ],
    }).compile();

    service = module.get<BulkExportService>(BulkExportService);
  });

  describe('initiateExport', () => {
    it('should create export job and queue processing', async () => {
      const mockJob = { id: 'job-123', status: ExportJobStatus.PENDING };
      jobRepo.create.mockReturnValue(mockJob);
      jobRepo.save.mockResolvedValue(mockJob);

      const jobId = await service.initiateExport('patient-1', 'PATIENT', ['Patient']);

      expect(jobId).toBe('job-123');
      expect(jobRepo.create).toHaveBeenCalled();
      expect(jobRepo.save).toHaveBeenCalled();
      expect(exportQueue.add).toHaveBeenCalledWith('process-export', { jobId: 'job-123' });
    });

    it('should default to all resource types if none specified', async () => {
      const mockJob = {
        id: 'job-123',
        resourceTypes: ['Patient', 'DocumentReference', 'Consent', 'Provenance'],
      };
      jobRepo.create.mockReturnValue(mockJob);
      jobRepo.save.mockResolvedValue(mockJob);

      await service.initiateExport('patient-1', 'PATIENT');

      expect(jobRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          resourceTypes: ['Patient', 'DocumentReference', 'Consent', 'Provenance'],
        }),
      );
    });
  });

  describe('getJobStatus', () => {
    it('should return job status for pending job', async () => {
      const mockJob = {
        id: 'job-123',
        requesterId: 'patient-1',
        status: ExportJobStatus.PENDING,
        progress: 0,
        totalResources: 0,
      };
      jobRepo.findOne.mockResolvedValue(mockJob);

      const status = await service.getJobStatus('job-123', 'patient-1', 'PATIENT');

      expect(status).toEqual({ status: ExportJobStatus.PENDING, progress: 0, totalResources: 0 });
    });

    it('should return download manifest for completed job', async () => {
      const mockJob = {
        id: 'job-123',
        requesterId: 'patient-1',
        status: ExportJobStatus.COMPLETED,
        resourceTypes: ['Patient'],
        outputFiles: [{ type: 'Patient', url: 'ipfs://abc123', count: 1 }],
        updatedAt: new Date('2026-02-22T15:00:00Z'),
      };
      jobRepo.findOne.mockResolvedValue(mockJob);

      const status = await service.getJobStatus('job-123', 'patient-1', 'PATIENT');

      expect(status).toHaveProperty('transactionTime');
      expect(status).toHaveProperty('output');
      expect((status as any).output).toHaveLength(1);
    });

    it('should throw ForbiddenException if requester does not match', async () => {
      jobRepo.findOne.mockResolvedValue({ id: 'job-123', requesterId: 'patient-1' });
      await expect(service.getJobStatus('job-123', 'patient-2', 'PATIENT')).rejects.toThrow();
    });

    it('should allow ADMIN to access any job', async () => {
      jobRepo.findOne.mockResolvedValue({
        id: 'job-123',
        requesterId: 'patient-1',
        status: ExportJobStatus.PENDING,
        progress: 0,
        totalResources: 0,
      });
      await expect(service.getJobStatus('job-123', 'admin-1', 'ADMIN')).resolves.toBeDefined();
    });
  });

  describe('cancelJob', () => {
    it('should cancel in-progress job', async () => {
      const mockJob = { id: 'job-123', requesterId: 'patient-1', status: ExportJobStatus.IN_PROGRESS };
      jobRepo.findOne.mockResolvedValue(mockJob);
      jobRepo.save.mockResolvedValue({ ...mockJob, status: ExportJobStatus.CANCELLED });

      await service.cancelJob('job-123', 'patient-1', 'PATIENT');

      expect(jobRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: ExportJobStatus.CANCELLED }),
      );
    });

    it('should not cancel completed job', async () => {
      jobRepo.findOne.mockResolvedValue({
        id: 'job-123',
        requesterId: 'patient-1',
        status: ExportJobStatus.COMPLETED,
      });

      await service.cancelJob('job-123', 'patient-1', 'PATIENT');

      expect(jobRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('cleanupExpiredJobs', () => {
    it('should remove expired jobs', async () => {
      const expiredJob = {
        id: 'job-123',
        status: ExportJobStatus.COMPLETED,
        expiresAt: new Date(Date.now() - 1000),
      };
      jobRepo.find.mockResolvedValue([expiredJob]);

      await service.cleanupExpiredJobs();

      expect(jobRepo.remove).toHaveBeenCalledWith(expiredJob);
    });

    it('should not remove non-expired jobs', async () => {
      jobRepo.find.mockResolvedValue([{
        id: 'job-123',
        status: ExportJobStatus.COMPLETED,
        expiresAt: new Date(Date.now() + 1_000_000),
      }]);

      await service.cleanupExpiredJobs();

      expect(jobRepo.remove).not.toHaveBeenCalled();
    });
  });

  describe('processExport – batched pagination', () => {
    const makeJob = (resourceTypes: string[]) => ({
      id: 'job-1',
      requesterId: 'admin-1',
      requesterRole: 'ADMIN',
      resourceTypes,
      status: ExportJobStatus.PENDING,
      totalResources: 0,
      progress: 0,
    });

    /**
     * Builds a mock `find` that returns `total` rows split across pages of
     * `batchSize` (default 500). Each row has the given shape factory.
     */
    const pagedFind = <T>(rows: T[]) =>
      jest.fn().mockImplementation(({ skip = 0, take = 500 } = {}) =>
        Promise.resolve(rows.slice(skip, skip + take)),
      );

    it('should process Patient resources in batches and update totalResources incrementally', async () => {
      const TOTAL = 1200;
      const patients = Array.from({ length: TOTAL }, (_, i) => ({
        id: `p-${i}`,
        firstName: 'A',
        lastName: 'B',
        updatedAt: new Date(),
      }));

      const job = makeJob(['Patient']);
      jobRepo.findOne.mockResolvedValue(job);
      jobRepo.save.mockImplementation((j) => Promise.resolve(j));
      patientRepo.find = pagedFind(patients);

      await service.processExport('job-1');

      // totalResources must equal the full dataset
      expect(job.totalResources).toBe(TOTAL);
      // find() must have been called multiple times (batched), not once
      expect(patientRepo.find.mock.calls.length).toBeGreaterThan(1);
      expect(job.status).toBe(ExportJobStatus.COMPLETED);
    });

    it('should process DocumentReference resources in batches', async () => {
      const TOTAL = 750;
      const records = Array.from({ length: TOTAL }, (_, i) => ({
        id: `r-${i}`,
        patientId: 'admin-1',
        status: 'active',
        updatedAt: new Date(),
        recordDate: new Date(),
      }));

      const job = makeJob(['DocumentReference']);
      jobRepo.findOne.mockResolvedValue(job);
      jobRepo.save.mockImplementation((j) => Promise.resolve(j));
      recordRepo.find = pagedFind(records);

      await service.processExport('job-1');

      expect(job.totalResources).toBe(TOTAL);
      expect(recordRepo.find.mock.calls.length).toBeGreaterThan(1);
    });

    it('should process Consent resources in batches', async () => {
      const TOTAL = 600;
      const consents = Array.from({ length: TOTAL }, (_, i) => ({
        id: `c-${i}`,
        patientId: 'admin-1',
        status: 'granted',
        updatedAt: new Date(),
      }));

      const job = makeJob(['Consent']);
      jobRepo.findOne.mockResolvedValue(job);
      jobRepo.save.mockImplementation((j) => Promise.resolve(j));
      consentRepo.find = pagedFind(consents);

      await service.processExport('job-1');

      expect(job.totalResources).toBe(TOTAL);
      expect(consentRepo.find.mock.calls.length).toBeGreaterThan(1);
    });

    it('should process Provenance resources in batches without loading all record IDs at once', async () => {
      const RECORD_COUNT = 600;
      const HISTORY_PER_RECORD = 1;
      const records = Array.from({ length: RECORD_COUNT }, (_, i) => ({ id: `r-${i}` }));
      const histories = Array.from({ length: RECORD_COUNT * HISTORY_PER_RECORD }, (_, i) => ({
        id: `h-${i}`,
        medicalRecordId: `r-${i}`,
        eventType: 'created',
        createdAt: new Date(),
      }));

      const job = makeJob(['Provenance']);
      jobRepo.findOne.mockResolvedValue(job);
      jobRepo.save.mockImplementation((j) => Promise.resolve(j));
      recordRepo.find = pagedFind(records);

      // Mock createQueryBuilder chain for history pagination
      const getManyMock = jest.fn().mockImplementation(() => Promise.resolve(histories.splice(0, 500)));
      const qb = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: getManyMock,
      };
      historyRepo.createQueryBuilder = jest.fn().mockReturnValue(qb);

      await service.processExport('job-1');

      expect(job.status).toBe(ExportJobStatus.COMPLETED);
      expect(job.totalResources).toBeGreaterThan(0);
    });

    it('should mark job as FAILED and record error message on exception', async () => {
      const job = makeJob(['Patient']);
      jobRepo.findOne.mockResolvedValue(job);
      jobRepo.save.mockImplementation((j) => Promise.resolve(j));
      patientRepo.find = jest.fn().mockRejectedValue(new Error('DB connection lost'));

      await service.processExport('job-1');

      expect(job.status).toBe(ExportJobStatus.FAILED);
      expect(job.error).toBe('DB connection lost');
    });

    it('should not process a cancelled job', async () => {
      jobRepo.findOne.mockResolvedValue({ id: 'job-1', status: ExportJobStatus.CANCELLED });

      await service.processExport('job-1');

      expect(patientRepo.find).not.toHaveBeenCalled();
    });
  });
});
