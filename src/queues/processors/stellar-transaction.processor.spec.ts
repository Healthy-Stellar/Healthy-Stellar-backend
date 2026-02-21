import { Test, TestingModule } from '@nestjs/testing';
import { StellarTransactionProcessor } from './stellar-transaction.processor';
import { JOB_TYPES } from '../queue.constants';

describe('StellarTransactionProcessor', () => {
  let processor: StellarTransactionProcessor;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StellarTransactionProcessor],
    }).compile();

    processor = module.get<StellarTransactionProcessor>(
      StellarTransactionProcessor,
    );
  });

  describe('process', () => {
    it('should process anchorRecord job successfully', async () => {
      const mockJob = {
        id: 'job-1',
        data: {
          operationType: JOB_TYPES.ANCHOR_RECORD,
          params: { recordId: '123' },
          initiatedBy: 'user-1',
          correlationId: 'corr-123',
        },
      } as any;

      const result = await processor.process(mockJob);

      expect(result).toHaveProperty('txHash');
      expect(result.status).toBe('anchored');
    });

    it('should process grantAccess job successfully', async () => {
      const mockJob = {
        id: 'job-2',
        data: {
          operationType: JOB_TYPES.GRANT_ACCESS,
          params: { userId: '456' },
          initiatedBy: 'user-1',
          correlationId: 'corr-456',
        },
      } as any;

      const result = await processor.process(mockJob);

      expect(result).toHaveProperty('txHash');
      expect(result.status).toBe('access_granted');
    });

    it('should process revokeAccess job successfully', async () => {
      const mockJob = {
        id: 'job-3',
        data: {
          operationType: JOB_TYPES.REVOKE_ACCESS,
          params: { userId: '789' },
          initiatedBy: 'user-1',
          correlationId: 'corr-789',
        },
      } as any;

      const result = await processor.process(mockJob);

      expect(result).toHaveProperty('txHash');
      expect(result.status).toBe('access_revoked');
    });

    it('should throw error for unknown operation type', async () => {
      const mockJob = {
        id: 'job-4',
        data: {
          operationType: 'unknownOperation',
          params: {},
          initiatedBy: 'user-1',
          correlationId: 'corr-999',
        },
      } as any;

      await expect(processor.process(mockJob)).rejects.toThrow(
        'Unknown operation type: unknownOperation',
      );
    });
  });
});
