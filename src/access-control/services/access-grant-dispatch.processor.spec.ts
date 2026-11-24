import { EntityManager, Repository } from 'typeorm';
import { Job } from 'bullmq';
import { AccessGrant, GrantStatus } from '../entities/access-grant.entity';
import { AccessRequest } from '../entities/access-request.entity';
import { SorobanQueueService } from './soroban-queue.service';
import { AccessGrantDispatchProcessor } from './access-grant-dispatch.processor';

describe('AccessGrantDispatchProcessor', () => {
  const grant = {
    id: 'grant-1',
    status: GrantStatus.PENDING_CHAIN,
    sorobanTxHash: null,
  } as AccessGrant;

  let grantRepository: {
    findOneBy: jest.Mock;
    manager: { transaction: jest.Mock };
  };
  let updateGrant: jest.Mock;
  let updateRequest: jest.Mock;
  let sorobanQueue: { dispatchGrant: jest.Mock };
  let processor: AccessGrantDispatchProcessor;

  beforeEach(() => {
    updateGrant = jest.fn().mockResolvedValue({ affected: 1 });
    updateRequest = jest.fn().mockResolvedValue({ affected: 1 });
    grantRepository = {
      findOneBy: jest.fn().mockResolvedValue(grant),
      manager: {
        transaction: jest.fn(
          async (callback: (manager: EntityManager) => Promise<unknown>) =>
            callback({
              getRepository: (entity: unknown) =>
                entity === AccessGrant
                  ? { update: updateGrant }
                  : { update: updateRequest },
            } as unknown as EntityManager),
        ),
      },
    };
    sorobanQueue = {
      dispatchGrant: jest.fn().mockResolvedValue('confirmed-tx-hash'),
    };
    processor = new AccessGrantDispatchProcessor(
      grantRepository as unknown as Repository<AccessGrant>,
      {} as Repository<AccessRequest>,
      sorobanQueue as unknown as SorobanQueueService,
    );
  });

  it('activates the grant and stores its transaction hash only after confirmation', async () => {
    const result = await processor.process({
      data: { grantId: 'grant-1', requestId: 'request-1' },
    } as Job<{ grantId: string; requestId: string }>);

    expect(sorobanQueue.dispatchGrant).toHaveBeenCalledWith(grant);
    expect(updateGrant).toHaveBeenCalledWith('grant-1', {
      status: GrantStatus.ACTIVE,
      sorobanTxHash: 'confirmed-tx-hash',
    });
    expect(updateRequest).toHaveBeenCalledWith('request-1', {
      sorobanTxHash: 'confirmed-tx-hash',
    });
    expect(result).toEqual({ txHash: 'confirmed-tx-hash' });
  });

  it('leaves the grant pending when Soroban dispatch fails', async () => {
    sorobanQueue.dispatchGrant.mockRejectedValue(new Error('Soroban unavailable'));

    await expect(
      processor.process({
        data: { grantId: 'grant-1', requestId: 'request-1' },
      } as Job<{ grantId: string; requestId: string }>),
    ).rejects.toThrow('Soroban unavailable');

    expect(updateGrant).not.toHaveBeenCalled();
    expect(updateRequest).not.toHaveBeenCalled();
  });
});
