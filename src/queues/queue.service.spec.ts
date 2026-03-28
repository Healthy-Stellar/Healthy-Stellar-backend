import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { QueueService } from './queue.service';
import { QUEUE_NAMES, JOB_TYPES, JOB_STATUS } from './queue.constants';
import { NotFoundException } from '@nestjs/common';
import { TracingService } from '../common/services/tracing.service';

describe('QueueService', () => {
  let service: QueueService;
  let mockStellarQueue: any;
  let mockContractWritesQueue: any;
  let mockIpfsQueue: any;
  let mockEventIndexingQueue: any;
  let mockEmailQueue: any;
  let mockReportsQueue: any;
  let mockTracingService: any;

  beforeEach(async () => {
    // Mock queues
    mockStellarQueue = {
      add: jest.fn(),
      getJobs: jest.fn(),
      getJob: jest.fn(),
    };

    mockContractWritesQueue = {
      add: jest.fn(),
      getJobs: jest.fn(),
      getJob: jest.fn(),
    };

    mockIpfsQueue = {
      add: jest.fn(),
      getJobs: jest.fn(),
      getJob: jest.fn(),
    };

    mockEventIndexingQueue = {
      add: jest.fn(),
      getJobs: jest.fn(),
      getJob: jest.fn(),
    };

    mockEmailQueue = {
      add: jest.fn(),
      getJobs: jest.fn(),
      getJob: jest.fn(),
    };

    mockReportsQueue = {
      add: jest.fn(),
      getJobs: jest.fn(),
      getJob: jest.fn(),
    };

    // Mock tracing service
    mockTracingService = {
      withSpan: jest.fn(async (name, fn) => {
        const mockSpan = {
          setAttribute: jest.fn(),
          addEvent: jest.fn(),
          end: jest.fn(),
        };
        return fn(mockSpan);
      }),
      getCurrentTraceId: jest.fn(() => 'trace-123'),
      addEvent: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueueService,
        {
          provide: getQueueToken(QUEUE_NAMES.STELLAR_TRANSACTIONS),
          useValue: mockStellarQueue,
        },
        {
          provide: getQueueToken(QUEUE_NAMES.CONTRACT_WRITES),
          useValue: mockContractWritesQueue,
        },
        {
          provide: getQueueToken(QUEUE_NAMES.IPFS_UPLOADS),
          useValue: mockIpfsQueue,
        },
        {
          provide: getQueueToken(QUEUE_NAMES.EVENT_INDEXING),
          useValue: mockEventIndexingQueue,
        },
        {
          provide: getQueueToken(QUEUE_NAMES.EMAIL_NOTIFICATIONS),
          useValue: mockEmailQueue,
        },
        {
          provide: getQueueToken(QUEUE_NAMES.REPORTS),
          useValue: mockReportsQueue,
        },
        {
          provide: TracingService,
          useValue: mockTracingService,
        },
      ],
    }).compile();

    service = module.get<QueueService>(QueueService);
  });

  describe('dispatchContractWrite', () => {
    it('should dispatch contract write job successfully', async () => {
      const jobData = {
        operationType: JOB_TYPES.ANCHOR_RECORD,
        params: { patientId: '123', cid: 'QmHash' },
        initiatedBy: 'user-456',
        correlationId: 'corr-789',
      };

      const mockJob = {
        id: 'job-001',
        data: jobData,
      };

      mockContractWritesQueue.add.mockResolvedValue(mockJob);

      const result = await service.dispatchContractWrite(jobData);

      expect(result).toEqual({
        jobId: 'job-001',
        correlationId: 'corr-789',
      });

      expect(mockContractWritesQueue.add).toHaveBeenCalledWith(
        JOB_TYPES.ANCHOR_RECORD,
        expect.objectContaining({
          operationType: JOB_TYPES.ANCHOR_RECORD,
          correlationId: 'corr-789',
        }),
        expect.objectContaining({
          jobId: 'corr-789',
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        }),
      );
    });

    it('should include trace context in job data', async () => {
      const jobData = {
        operationType: JOB_TYPES.GRANT_ACCESS,
        params: { patientId: '123', granteeId: '456', recordId: '789' },
        initiatedBy: 'user-001',
        correlationId: 'corr-001',
      };

      const mockJob = { id: 'job-002', data: jobData };
      mockContractWritesQueue.add.mockResolvedValue(mockJob);

      await service.dispatchContractWrite(jobData);

      const callArgs = mockContractWritesQueue.add.mock.calls[0];
      expect(callArgs[1]).toHaveProperty('traceContext');
      expect(callArgs[1]).toHaveProperty('traceId', 'trace-123');
    });
  });

  describe('dispatchStellarTransaction', () => {
    it('should dispatch Stellar transaction job', async () => {
      const jobData = {
        operationType: JOB_TYPES.REVOKE_ACCESS,
        params: { patientId: '123', granteeId: '456', recordId: '789' },
        initiatedBy: 'user-001',
        correlationId: 'corr-abc',
      };

      const mockJob = { id: 'job-003', data: jobData };
      mockStellarQueue.add.mockResolvedValue(mockJob);

      const result = await service.dispatchStellarTransaction(jobData);

      expect(result).toEqual({
        jobId: 'job-003',
        correlationId: 'corr-abc',
      });

      expect(mockStellarQueue.add).toHaveBeenCalled();
    });
  });

  describe('dispatchIpfsUpload', () => {
    it('should dispatch IPFS upload job', async () => {
      const jobData = {
        correlationId: 'corr-ipfs',
        data: Buffer.from('test data'),
        fileName: 'test.txt',
      };

      const mockJob = { id: 'job-ipfs-001', data: jobData };
      mockIpfsQueue.add.mockResolvedValue(mockJob);

      const result = await service.dispatchIpfsUpload(jobData);

      expect(result).toEqual({
        jobId: 'job-ipfs-001',
        correlationId: 'corr-ipfs',
      });
    });
  });

  describe('dispatchEventIndexing', () => {
    it('should dispatch event indexing job', async () => {
      const jobData = {
        correlationId: 'corr-event',
        eventType: 'ContractEventAnchorRecord',
        contractAddress: 'CAAAA',
        data: { blockHeight: 12345 },
      };

      const mockJob = { id: 'job-event-001', data: jobData };
      mockEventIndexingQueue.add.mockResolvedValue(mockJob);

      const result = await service.dispatchEventIndexing(jobData);

      expect(result).toEqual({
        jobId: 'job-event-001',
        correlationId: 'corr-event',
      });
    });
  });

  describe('getJobStatusById', () => {
    it('should return job status when found', async () => {
      const mockJob = {
        id: 'job-001',
        data: { correlationId: 'corr-789' },
        _state: 'active',
        _progress: 50,
        attemptsMade: 0,
        timestamp: Date.now(),
        processedOn: Date.now(),
        finishedOn: null,
        failedReason: null,
        returnvalue: null,
      };

      mockContractWritesQueue.getJob.mockResolvedValue(mockJob);
      mockStellarQueue.getJob.mockResolvedValue(null);
      mockIpfsQueue.getJob.mockResolvedValue(null);

      const result = await service.getJobStatusById('job-001');

      expect(result).toEqual(
        expect.objectContaining({
          jobId: 'job-001',
          correlationId: 'corr-789',
          status: JOB_STATUS.PROCESSING,
          progress: 50,
        }),
      );
    });

    it('should throw NotFoundException when job not found in any queue', async () => {
      mockContractWritesQueue.getJob.mockResolvedValue(null);
      mockStellarQueue.getJob.mockResolvedValue(null);
      mockIpfsQueue.getJob.mockResolvedValue(null);
      mockEventIndexingQueue.getJob.mockResolvedValue(null);
      mockEmailQueue.getJob.mockResolvedValue(null);
      mockReportsQueue.getJob.mockResolvedValue(null);

      await expect(service.getJobStatusById('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should map job states correctly', async () => {
      const testCases = [
        { state: 'waiting', expected: JOB_STATUS.PENDING },
        { state: 'active', expected: JOB_STATUS.PROCESSING },
        { state: 'completed', expected: JOB_STATUS.COMPLETED },
        { state: 'failed', expected: JOB_STATUS.FAILED },
      ];

      for (const { state, expected } of testCases) {
        const mockJob = {
          id: 'job-001',
          data: { correlationId: 'corr-test' },
          _state: state,
          _progress: 0,
          attemptsMade: 0,
          timestamp: Date.now(),
          processedOn: null,
          finishedOn: null,
          failedReason: null,
          returnvalue: null,
        };

        mockContractWritesQueue.getJob.mockResolvedValue(mockJob);

        const result = await service.getJobStatusById('job-001');

        expect(result.status).toBe(expected);

        mockContractWritesQueue.getJob.mockResolvedValue(null);
      }
    });
  });

  describe('getJobStatus (by correlation ID)', () => {
    it('should find job by correlation ID', async () => {
      const mockJob = {
        id: 'job-002',
        data: { correlationId: 'corr-search' },
        getState: jest.fn().mockResolvedValue('completed'),
        _state: 'completed',
        _progress: 100,
        attemptsMade: 1,
        timestamp: Date.now(),
        processedOn: Date.now(),
        finishedOn: Date.now(),
        failedReason: null,
        returnvalue: { status: 'success' },
      };

      mockContractWritesQueue.getJobs.mockResolvedValue([
        mockJob,
        { id: 'job-other', data: { correlationId: 'corr-other' } },
      ]);
      mockStellarQueue.getJobs.mockResolvedValue([]);

      const result = await service.getJobStatus('corr-search');

      expect(result).toEqual(
        expect.objectContaining({
          jobId: 'job-002',
          correlationId: 'corr-search',
          status: JOB_STATUS.COMPLETED,
          progress: 100,
        }),
      );
    });

    it('should search through all queues', async () => {
      const mockJob = {
        id: 'job-ipfs',
        data: { correlationId: 'corr-ipfs-search' },
        _state: 'completed',
        _progress: 100,
        attemptsMade: 0,
        timestamp: Date.now(),
        processedOn: Date.now(),
        finishedOn: Date.now(),
        failedReason: null,
        returnvalue: null,
      };

      // Set up all queues to return empty except IPFS queue
      mockContractWritesQueue.getJobs.mockResolvedValue([]);
      mockStellarQueue.getJobs.mockResolvedValue([]);
      mockEventIndexingQueue.getJobs.mockResolvedValue([]);
      mockEmailQueue.getJobs.mockResolvedValue([]);
      mockReportsQueue.getJobs.mockResolvedValue([]);
      mockIpfsQueue.getJobs.mockResolvedValue([mockJob]);

      const result = await service.getJobStatus('corr-ipfs-search');

      expect(result).toEqual(
        expect.objectContaining({
          jobId: 'job-ipfs',
          correlationId: 'corr-ipfs-search',
        }),
      );
    });

    it('should throw when no jobs found by correlation ID', async () => {
      mockContractWritesQueue.getJobs.mockResolvedValue([]);
      mockStellarQueue.getJobs.mockResolvedValue([]);
      mockIpfsQueue.getJobs.mockResolvedValue([]);
      mockEventIndexingQueue.getJobs.mockResolvedValue([]);
      mockEmailQueue.getJobs.mockResolvedValue([]);
      mockReportsQueue.getJobs.mockResolvedValue([]);

      await expect(
        service.getJobStatus('corr-not-found'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Job status response building', () => {
    it('should build complete status response with all fields', async () => {
      const mockJob = {
        id: 'job-complete',
        data: { correlationId: 'corr-complete' },
        _state: 'completed',
        _progress: 100,
        attemptsMade: 2,
        timestamp: 1000000,
        processedOn: 1000005,
        finishedOn: 1000010,
        failedReason: null,
        returnvalue: { status: 'success', txHash: 'hash123' },
      };

      mockContractWritesQueue.getJob.mockResolvedValue(mockJob);

      const result = await service.getJobStatusById('job-complete');

      expect(result).toHaveProperty('jobId', 'job-complete');
      expect(result).toHaveProperty('correlationId', 'corr-complete');
      expect(result).toHaveProperty('status', JOB_STATUS.COMPLETED);
      expect(result).toHaveProperty('progress', 100);
      expect(result).toHaveProperty('attempts', 2);
      expect(result).toHaveProperty('error', null);
      expect(result).toHaveProperty('result');
      expect(result).toHaveProperty('createdAt');
      expect(result).toHaveProperty('startedAt');
      expect(result).toHaveProperty('completedAt');
    });

    it('should include error reason when job fails', async () => {
      const mockJob = {
        id: 'job-failed',
        data: { correlationId: 'corr-failed' },
        _state: 'failed',
        _progress: 50,
        attemptsMade: 3,
        timestamp: 1000000,
        processedOn: 1000005,
        finishedOn: 1000015,
        failedReason: 'Contract call timeout',
        returnvalue: null,
      };

      mockContractWritesQueue.getJob.mockResolvedValue(mockJob);

      const result = await service.getJobStatusById('job-failed');

      expect(result.status).toBe(JOB_STATUS.FAILED);
      expect(result.error).toBe('Contract call timeout');
      expect(result.result).toBeNull();
    });
  });
});
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

      await expect(service.getJobStatus('invalid')).rejects.toThrow(NotFoundException);
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
