import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { BulkExportService } from '../services/bulk-export.service';
import { BulkExportJob, ExportJobStatus } from '../entities/bulk-export-job.entity';
import { Patient } from '../../patients/entities/patient.entity';
import { MedicalRecord } from '../../medical-records/entities/medical-record.entity';
import { MedicalRecordConsent } from '../../medical-records/entities/medical-record-consent.entity';
import { MedicalHistory } from '../../medical-records/entities/medical-history.entity';

describe('BulkExportService', () => {
  let service: BulkExportService;
  let jobRepo: any;
  let exportQueue: any;

  beforeEach(async () => {
    const mockRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      remove: jest.fn(),
    };

    const mockQueue = {
      add: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BulkExportService,
        { provide: getRepositoryToken(BulkExportJob), useValue: mockRepo },
        { provide: getRepositoryToken(Patient), useValue: mockRepo },
        { provide: getRepositoryToken(MedicalRecord), useValue: mockRepo },
        { provide: getRepositoryToken(MedicalRecordConsent), useValue: mockRepo },
        { provide: getRepositoryToken(MedicalHistory), useValue: mockRepo },
        { provide: getQueueToken('fhir-bulk-export'), useValue: mockQueue },
      ],
    }).compile();

    service = module.get<BulkExportService>(BulkExportService);
    jobRepo = module.get(getRepositoryToken(BulkExportJob));
    exportQueue = module.get(getQueueToken('fhir-bulk-export'));
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
      const mockJob = { id: 'job-123', resourceTypes: ['Patient', 'DocumentReference', 'Consent', 'Provenance'] };
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

      expect(status).toEqual({
        status: ExportJobStatus.PENDING,
        progress: 0,
        totalResources: 0,
      });
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
      expect(status.output).toHaveLength(1);
    });

    it('should throw ForbiddenException if requester does not match', async () => {
      const mockJob = { id: 'job-123', requesterId: 'patient-1' };
      jobRepo.findOne.mockResolvedValue(mockJob);

      await expect(service.getJobStatus('job-123', 'patient-2', 'PATIENT')).rejects.toThrow();
    });

    it('should allow ADMIN to access any job', async () => {
      const mockJob = {
        id: 'job-123',
        requesterId: 'patient-1',
        status: ExportJobStatus.PENDING,
        progress: 0,
        totalResources: 0,
      };
      jobRepo.findOne.mockResolvedValue(mockJob);

      const status = await service.getJobStatus('job-123', 'admin-1', 'ADMIN');

      expect(status).toBeDefined();
    });
  });

  describe('cancelJob', () => {
    it('should cancel in-progress job', async () => {
      const mockJob = {
        id: 'job-123',
        requesterId: 'patient-1',
        status: ExportJobStatus.IN_PROGRESS,
      };
      jobRepo.findOne.mockResolvedValue(mockJob);
      jobRepo.save.mockResolvedValue({ ...mockJob, status: ExportJobStatus.CANCELLED });

      await service.cancelJob('job-123', 'patient-1', 'PATIENT');

      expect(jobRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: ExportJobStatus.CANCELLED }),
      );
    });

    it('should not cancel completed job', async () => {
      const mockJob = {
        id: 'job-123',
        requesterId: 'patient-1',
        status: ExportJobStatus.COMPLETED,
      };
      jobRepo.findOne.mockResolvedValue(mockJob);

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
      const activeJob = {
        id: 'job-123',
        status: ExportJobStatus.COMPLETED,
        expiresAt: new Date(Date.now() + 1000000),
      };
      jobRepo.find.mockResolvedValue([activeJob]);

      await service.cleanupExpiredJobs();

      expect(jobRepo.remove).not.toHaveBeenCalled();
    });
  });
});
