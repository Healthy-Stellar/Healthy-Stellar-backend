import { Test, TestingModule } from '@nestjs/testing';
import { ContractWritesProcessor } from './contract-writes.processor';
import { StellarContractService } from '../../blockchain/stellar-contract.service';
import { QUEUE_NAMES, JOB_TYPES } from '../queue.constants';
import { Logger } from '@nestjs/common';

describe('ContractWritesProcessor', () => {
  let processor: ContractWritesProcessor;
  let mockStellarContractService: any;
  let mockJob: any;
  let mockSpan: any;

  beforeEach(async () => {
    // Mock Stellar Contract Service
    mockStellarContractService = {
      anchorRecord: jest.fn(),
      grantAccess: jest.fn(),
      revokeAccess: jest.fn(),
      verifyAccess: jest.fn(),
    };

    // Mock job object
    mockJob = {
      id: 'job-123',
      data: {
        operationType: JOB_TYPES.ANCHOR_RECORD,
        params: { patientId: 'pat-123', cid: 'Qm...' },
        initiatedBy: 'user-456',
        correlationId: 'corr-789',
        traceContext: {},
      },
      attemptsMade: 0,
      opts: { attempts: 3 },
      progress: jest.fn(),
    };

    // Mock span
    mockSpan = {
      setAttribute: jest.fn(),
      addEvent: jest.fn(),
      recordException: jest.fn(),
      end: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContractWritesProcessor,
        {
          provide: StellarContractService,
          useValue: mockStellarContractService,
        },
      ],
    }).compile();

    processor = module.get<ContractWritesProcessor>(ContractWritesProcessor);

    // Suppress logs during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('process', () => {
    it('should process anchor record operation successfully', async () => {
      mockStellarContractService.anchorRecord.mockResolvedValue({
        txHash: 'tx-hash-123',
        blockHeight: 12345,
      });

      const result = await processor.process(mockJob);

      expect(result).toEqual(
        expect.objectContaining({
          status: 'success',
          operation: 'anchorRecord',
          patientId: 'pat-123',
          cid: 'Qm...',
          txHash: 'tx-hash-123',
        }),
      );

      expect(mockJob.progress).toHaveBeenCalledWith(10);
      expect(mockJob.progress).toHaveBeenCalledWith(90);
      expect(mockJob.progress).toHaveBeenCalledWith(100);
    });

    it('should process grant access operation successfully', async () => {
      mockJob.data.operationType = JOB_TYPES.GRANT_ACCESS;
      mockJob.data.params = {
        patientId: 'pat-123',
        granteeId: 'grantee-456',
        recordId: 'rec-789',
        expirationTime: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
      };

      mockStellarContractService.grantAccess.mockResolvedValue({
        txHash: 'tx-hash-grant',
      });

      const result = await processor.process(mockJob);

      expect(result).toEqual(
        expect.objectContaining({
          status: 'success',
          operation: 'grantAccess',
          patientId: 'pat-123',
          granteeId: 'grantee-456',
        }),
      );

      expect(mockStellarContractService.grantAccess).toHaveBeenCalledWith(
        expect.objectContaining({
          patientId: 'pat-123',
          granteeId: 'grantee-456',
          recordId: 'rec-789',
        }),
      );
    });

    it('should process revoke access operation successfully', async () => {
      mockJob.data.operationType = JOB_TYPES.REVOKE_ACCESS;
      mockJob.data.params = {
        patientId: 'pat-123',
        granteeId: 'grantee-456',
        recordId: 'rec-789',
      };

      mockStellarContractService.revokeAccess.mockResolvedValue({
        txHash: 'tx-hash-revoke',
      });

      const result = await processor.process(mockJob);

      expect(result).toEqual(
        expect.objectContaining({
          status: 'success',
          operation: 'revokeAccess',
          patientId: 'pat-123',
          granteeId: 'grantee-456',
        }),
      );
    });

    it('should process verify access operation successfully', async () => {
      mockJob.data.operationType = JOB_TYPES.VERIFY_ACCESS;
      mockJob.data.params = {
        requesterId: 'req-123',
        recordId: 'rec-789',
      };

      mockStellarContractService.verifyAccess.mockResolvedValue({
        approved: true,
      });

      const result = await processor.process(mockJob);

      expect(result).toEqual(
        expect.objectContaining({
          status: 'success',
          operation: 'verifyAccess',
          requesterId: 'req-123',
          hasAccess: true,
        }),
      );
    });

    it('should throw error for unknown operation type', async () => {
      mockJob.data.operationType = 'UNKNOWN_OPERATION';

      await expect(processor.process(mockJob)).rejects.toThrow(
        /Unknown operation type/,
      );
    });

    it('should handle contract service errors', async () => {
      const contractError = new Error('Contract call failed');
      mockStellarContractService.anchorRecord.mockRejectedValue(
        contractError,
      );

      await expect(processor.process(mockJob)).rejects.toThrow(
        'Contract call failed',
      );
    });

    it('should set exponential backoff attempts for retries', async () => {
      mockJob.attemptsMade = 1;
      mockStellarContractService.anchorRecord.mockResolvedValue({
        txHash: 'tx-123',
      });

      const result = await processor.process(mockJob);

      expect(result).toBeDefined();
      expect(mockJob.progress).toHaveBeenCalled();
    });

    it('should use default expiration time if not provided for grant access', async () => {
      mockJob.data.operationType = JOB_TYPES.GRANT_ACCESS;
      mockJob.data.params = {
        patientId: 'pat-123',
        granteeId: 'grantee-456',
        recordId: 'rec-789',
        expirationTime: undefined, // No expiration provided
      };

      mockStellarContractService.grantAccess.mockResolvedValue({
        txHash: 'tx-123',
      });

      await processor.process(mockJob);

      const callArgs = mockStellarContractService.grantAccess.mock.calls[0][0];
      expect(callArgs.expirationTime).toBeDefined();
      expect(callArgs.expirationTime).toBeGreaterThan(
        Math.floor(Date.now() / 1000),
      );
    });

    it('should return correct timestamp format', async () => {
      mockStellarContractService.anchorRecord.mockResolvedValue({
        txHash: 'tx-123',
      });

      const result = await processor.process(mockJob);

      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('progress tracking', () => {
    it('should update progress for anchor record', async () => {
      mockStellarContractService.anchorRecord.mockResolvedValue({
        txHash: 'tx-123',
      });

      await processor.process(mockJob);

      expect(mockJob.progress).toHaveBeenCalledWith(10);
      expect(mockJob.progress).toHaveBeenCalledWith(30);
      expect(mockJob.progress).toHaveBeenCalledWith(90);
      expect(mockJob.progress).toHaveBeenCalledWith(100);
    });

    it('should update progress for grant access', async () => {
      mockJob.data.operationType = JOB_TYPES.GRANT_ACCESS;
      mockJob.data.params = {
        patientId: 'pat-123',
        granteeId: 'grantee-456',
        recordId: 'rec-789',
      };

      mockStellarContractService.grantAccess.mockResolvedValue({
        txHash: 'tx-123',
      });

      await processor.process(mockJob);

      expect(mockJob.progress).toHaveBeenCalledWith(10);
      expect(mockJob.progress).toHaveBeenCalledWith(30);
      expect(mockJob.progress).toHaveBeenCalledWith(90);
      expect(mockJob.progress).toHaveBeenCalledWith(100);
    });
  });
});
