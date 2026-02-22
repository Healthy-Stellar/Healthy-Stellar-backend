import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { QueueService } from './queue.service';
import { QUEUE_NAMES, JOB_TYPES, JOB_STATUS } from './queue.constants';
import { NotFoundException } from '@nestjs/common';

describe('QueueService', () => {
  let service: QueueService;
  let mockStellarQueue: any;
  let mockIpfsQueue: any;
  let mockEmailQueue: any;

  beforeEach(async () => {
    mockStellarQueue = {
      add: jest.fn(),
      getJobs: jest.fn(),
    };

    mockIpfsQueue = {
      getJobs: jest.fn(),
    };

    mockEmailQueue = {
      getJobs: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueueService,
        {
          provide: getQueueToken(QUEUE_NAMES.STELLAR_TRANSACTIONS),
          useValue: mockStellarQueue,
        },
        {
          provide: getQueueToken(QUEUE_NAMES.IPFS_UPLOADS),
          useValue: mockIpfsQueue,
        },
        {
          provide: getQueueToken(QUEUE_NAMES.EMAIL_NOTIFICATIONS),
          useValue: mockEmailQueue,
        },
      ],
    }).compile();

    service = module.get<QueueService>(QueueService);
  });

  describe('dispatchStellarTransaction', () => {
    it('should dispatch job with correct configuration', async () => {
      const jobData = {
        operationType: JOB_TYPES.ANCHOR_RECORD,
        params: { recordId: '123' },
        initiatedBy: 'user-1',
        correlationId: 'corr-123',
      };

      mockStellarQueue.add.mockResolvedValue({ id: 'job-1' });

      const result = await service.dispatchStellarTransaction(jobData);

      expect(mockStellarQueue.add).toHaveBeenCalledWith(
        jobData.operationType,
        jobData,
        expect.objectContaining({
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
        }),
      );
      expect(result).toBe('corr-123');
    });
  });

  describe('getJobStatus', () => {
    it('should return job status when found', async () => {
      const mockJob = {
        id: 'job-1',
        data: { correlationId: 'corr-123' },
        getState: jest.fn().mockResolvedValue('completed'),
        progress: 100,
        failedReason: null,
        returnvalue: { txHash: 'hash-123' },
        attemptsMade: 1,
        timestamp: Date.now(),
      };

      mockStellarQueue.getJobs.mockResolvedValue([mockJob]);
      mockIpfsQueue.getJobs.mockResolvedValue([]);
      mockEmailQueue.getJobs.mockResolvedValue([]);

      const result = await service.getJobStatus('corr-123');

      expect(result.status).toBe(JOB_STATUS.COMPLETED);
      expect(result.correlationId).toBe('corr-123');
    });

    it('should throw NotFoundException when job not found', async () => {
      mockStellarQueue.getJobs.mockResolvedValue([]);
      mockIpfsQueue.getJobs.mockResolvedValue([]);
      mockEmailQueue.getJobs.mockResolvedValue([]);

      await expect(service.getJobStatus('invalid')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should map job states correctly', async () => {
      const mockJob = {
        id: 'job-1',
        data: { correlationId: 'corr-123' },
        getState: jest.fn().mockResolvedValue('active'),
        progress: 50,
        failedReason: null,
        returnvalue: null,
        attemptsMade: 1,
        timestamp: Date.now(),
      };

      mockStellarQueue.getJobs.mockResolvedValue([mockJob]);
      mockIpfsQueue.getJobs.mockResolvedValue([]);
      mockEmailQueue.getJobs.mockResolvedValue([]);

      const result = await service.getJobStatus('corr-123');

      expect(result.status).toBe(JOB_STATUS.PROCESSING);
    });
  });
});
