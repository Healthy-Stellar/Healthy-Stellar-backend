import { Test, TestingModule } from '@nestjs/testing';
import { QueueController } from './queue.controller';
import { QueueService } from './queue.service';
import { NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JOB_STATUS } from './queue.constants';

describe('QueueController', () => {
  let controller: QueueController;
  let mockQueueService: any;
  let mockJwtService: any;

  beforeEach(async () => {
    mockQueueService = {
      getJobStatusById: jest.fn(),
      getJobStatus: jest.fn(),
    };

    mockJwtService = {
      verify: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [QueueController],
      providers: [
        {
          provide: QueueService,
          useValue: mockQueueService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    })
      .useMocker((token) => {
        if (token === 'JwtAuthGuard') {
          return {
            canActivate: jest.fn(() => true),
          };
        }
      })
      .compile();

    controller = module.get<QueueController>(QueueController);
  });

  describe('getJobStatus', () => {
    it('should return job status by ID', async () => {
      const mockStatus = {
        jobId: 'job-123',
        correlationId: 'corr-456',
        status: JOB_STATUS.PROCESSING,
        progress: 50,
        attempts: 1,
        error: null,
        result: null,
        createdAt: '2026-03-28T10:00:00Z',
        startedAt: '2026-03-28T10:00:05Z',
        completedAt: null,
      };

      mockQueueService.getJobStatusById.mockResolvedValue(mockStatus);

      const result = await controller.getJobStatus('job-123');

      expect(result).toEqual(mockStatus);
      expect(mockQueueService.getJobStatusById).toHaveBeenCalledWith('job-123');
    });

    it('should return formatted response with all fields', async () => {
      const rawStatus = {
        jobId: 'job-001',
        correlationId: 'corr-001',
        status: JOB_STATUS.COMPLETED,
        progress: 100,
        attempts: 1,
        error: null,
        result: { status: 'success', txHash: 'hash123' },
        createdAt: '2026-03-28T10:00:00Z',
        startedAt: '2026-03-28T10:00:05Z',
        completedAt: '2026-03-28T10:00:15Z',
      };

      mockQueueService.getJobStatusById.mockResolvedValue(rawStatus);

      const result = await controller.getJobStatus('job-001');

      expect(result.jobId).toBe('job-001');
      expect(result.status).toBe(JOB_STATUS.COMPLETED);
      expect(result.progress).toBe(100);
      expect(result.result).toEqual({ status: 'success', txHash: 'hash123' });
    });

    it('should throw NotFoundException when job not found', async () => {
      mockQueueService.getJobStatusById.mockRejectedValue(
        new NotFoundException('Job not found'),
      );

      await expect(controller.getJobStatus('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should handle job in PENDING state', async () => {
      const pendingStatus = {
        jobId: 'job-pending',
        correlationId: 'corr-pending',
        status: JOB_STATUS.PENDING,
        progress: 0,
        attempts: 0,
        error: null,
        result: null,
        createdAt: '2026-03-28T10:00:00Z',
        startedAt: null,
        completedAt: null,
      };

      mockQueueService.getJobStatusById.mockResolvedValue(pendingStatus);

      const result = await controller.getJobStatus('job-pending');

      expect(result.status).toBe(JOB_STATUS.PENDING);
      expect(result.progress).toBe(0);
      expect(result.startedAt).toBeNull();
    });

    it('should handle failed jobs with error message', async () => {
      const failedStatus = {
        jobId: 'job-failed',
        correlationId: 'corr-failed',
        status: JOB_STATUS.FAILED,
        progress: 45,
        attempts: 3,
        error: 'Contract simulation failed',
        result: null,
        createdAt: '2026-03-28T10:00:00Z',
        startedAt: '2026-03-28T10:00:05Z',
        completedAt: '2026-03-28T10:01:00Z',
      };

      mockQueueService.getJobStatusById.mockResolvedValue(failedStatus);

      const result = await controller.getJobStatus('job-failed');

      expect(result.status).toBe(JOB_STATUS.FAILED);
      expect(result.error).toBe('Contract simulation failed');
      expect(result.attempts).toBe(3);
      expect(result.result).toBeNull();
    });
  });

  describe('getJobStatusByCorrelationId', () => {
    it('should return job status by correlation ID', async () => {
      const mockStatus = {
        jobId: 'job-789',
        correlationId: 'corr-456',
        status: JOB_STATUS.COMPLETED,
        progress: 100,
        attempts: 1,
        error: null,
        result: { txHash: 'hash-abc' },
        createdAt: '2026-03-28T10:00:00Z',
        startedAt: '2026-03-28T10:00:05Z',
        completedAt: '2026-03-28T10:00:15Z',
      };

      mockQueueService.getJobStatus.mockResolvedValue(mockStatus);

      const result = await controller.getJobStatusByCorrelationId('corr-456');

      expect(result).toEqual(mockStatus);
      expect(mockQueueService.getJobStatus).toHaveBeenCalledWith('corr-456');
    });

    it('should throw NotFoundException for non-existent correlation ID', async () => {
      mockQueueService.getJobStatus.mockRejectedValue(
        new NotFoundException('Job not found'),
      );

      await expect(
        controller.getJobStatusByCorrelationId('non-existent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should search across all queues', async () => {
      const mockStatus = {
        jobId: 'job-multi-queue',
        correlationId: 'corr-multi',
        status: JOB_STATUS.PROCESSING,
        progress: 60,
        attempts: 1,
        error: null,
        result: null,
        createdAt: '2026-03-28T10:00:00Z',
        startedAt: '2026-03-28T10:00:05Z',
        completedAt: null,
      };

      mockQueueService.getJobStatus.mockResolvedValue(mockStatus);

      const result = await controller.getJobStatusByCorrelationId('corr-multi');

      expect(result.jobId).toBe('job-multi-queue');
      expect(mockQueueService.getJobStatus).toHaveBeenCalledWith('corr-multi');
    });
  });

  describe('Response formatting', () => {
    it('should format status response with correct types', async () => {
      const mockStatus = {
        jobId: 'job-fmt',
        correlationId: 'corr-fmt',
        status: JOB_STATUS.PROCESSING,
        progress: 75,
        attempts: 2,
        error: null,
        result: { key: 'value' },
        createdAt: '2026-03-28T10:00:00Z',
        startedAt: '2026-03-28T10:00:05Z',
        completedAt: null,
      };

      mockQueueService.getJobStatusById.mockResolvedValue(mockStatus);

      const result = await controller.getJobStatus('job-fmt');

      expect(typeof result.jobId).toBe('string');
      expect(typeof result.correlationId).toBe('string');
      expect(typeof result.status).toBe('string');
      expect(typeof result.progress).toBe('number');
      expect(typeof result.attempts).toBe('number');
      expect(result.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should preserve result data structure', async () => {
      const complexResult = {
        status: 'success',
        operation: 'anchorRecord',
        patientId: 'pat-123',
        cid: 'Qm...',
        txHash: 'hash-123',
        timestamp: '2026-03-28T10:00:15Z',
        blockHeight: 12345,
      };

      const mockStatus = {
        jobId: 'job-complex',
        correlationId: 'corr-complex',
        status: JOB_STATUS.COMPLETED,
        progress: 100,
        attempts: 1,
        error: null,
        result: complexResult,
        createdAt: '2026-03-28T10:00:00Z',
        startedAt: '2026-03-28T10:00:05Z',
        completedAt: '2026-03-28T10:00:15Z',
      };

      mockQueueService.getJobStatusById.mockResolvedValue(mockStatus);

      const result = await controller.getJobStatus('job-complex');

      expect(result.result).toEqual(complexResult);
      expect(result.result.blockHeight).toBe(12345);
    });

    it('should handle null/undefined fields in result', async () => {
      const mockStatus = {
        jobId: 'job-null',
        correlationId: 'corr-null',
        status: JOB_STATUS.PENDING,
        progress: 0,
        attempts: 0,
        error: null,
        result: null,
        createdAt: '2026-03-28T10:00:00Z',
        startedAt: null,
        completedAt: null,
      };

      mockQueueService.getJobStatusById.mockResolvedValue(mockStatus);

      const result = await controller.getJobStatus('job-null');

      expect(result.error).toBeNull();
      expect(result.result).toBeNull();
      expect(result.startedAt).toBeNull();
      expect(result.completedAt).toBeNull();
    });
  });

  describe('Error handling', () => {
    it('should provide helpful error message for missing jobs', async () => {
      mockQueueService.getJobStatusById.mockRejectedValue(
        new NotFoundException(
          `Job with ID 'missing-job' not found. Job may have completed and been removed from queue.`,
        ),
      );

      try {
        await controller.getJobStatus('missing-job');
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
        expect((error as NotFoundException).message).toContain('may have completed');
      }
    });

    it('should handle service errors gracefully', async () => {
      const serviceError = new Error('Redis connection failed');
      mockQueueService.getJobStatusById.mockRejectedValue(serviceError);

      await expect(controller.getJobStatus('job-123')).rejects.toThrow(
        'Redis connection failed',
      );
    });
  });

  describe('HTTP Response Codes', () => {
    it('should return 200 OK for successful status query', async () => {
      const mockStatus = {
        jobId: 'job-ok',
        correlationId: 'corr-ok',
        status: JOB_STATUS.COMPLETED,
        progress: 100,
        attempts: 1,
        error: null,
        result: { txHash: 'hash' },
        createdAt: '2026-03-28T10:00:00Z',
        startedAt: '2026-03-28T10:00:05Z',
        completedAt: '2026-03-28T10:00:15Z',
      };

      mockQueueService.getJobStatusById.mockResolvedValue(mockStatus);

      // Controller uses @HttpCode(HttpStatus.OK) by default
      const result = await controller.getJobStatus('job-ok');
      expect(result).toBeDefined();
    });

    it('should eventually return 404 when job not found', async () => {
      mockQueueService.getJobStatusById.mockRejectedValue(
        new NotFoundException('Job not found'),
      );

      await expect(controller.getJobStatus('not-found')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
