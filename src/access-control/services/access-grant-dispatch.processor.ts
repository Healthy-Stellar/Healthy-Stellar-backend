import { Processor, WorkerHost } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import { Repository } from 'typeorm';
import { AccessGrant, GrantStatus } from '../entities/access-grant.entity';
import { AccessRequest } from '../entities/access-request.entity';
import { SorobanQueueService } from './soroban-queue.service';
import { QUEUE_NAMES } from '../../queues/queue.constants';

interface AccessGrantDispatchJob {
  grantId: string;
  requestId: string;
}

@Processor(QUEUE_NAMES.ACCESS_GRANT_DISPATCH)
export class AccessGrantDispatchProcessor extends WorkerHost {
  constructor(
    @InjectRepository(AccessGrant)
    private readonly grantRepository: Repository<AccessGrant>,
    @InjectRepository(AccessRequest)
    private readonly requestRepository: Repository<AccessRequest>,
    private readonly sorobanQueue: SorobanQueueService,
  ) {
    super();
  }

  async process(job: Job<AccessGrantDispatchJob>): Promise<{ txHash: string }> {
    const grant = await this.grantRepository.findOneBy({ id: job.data.grantId });
    if (!grant) {
      throw new Error(`Access grant ${job.data.grantId} not found`);
    }

    if (grant.status === GrantStatus.ACTIVE && grant.sorobanTxHash) {
      return { txHash: grant.sorobanTxHash };
    }

    const txHash = await this.sorobanQueue.dispatchGrant(grant);
    await this.grantRepository.manager.transaction(async (manager) => {
      await manager.getRepository(AccessGrant).update(grant.id, {
        status: GrantStatus.ACTIVE,
        sorobanTxHash: txHash,
      });
      await manager.getRepository(AccessRequest).update(job.data.requestId, {
        sorobanTxHash: txHash,
      });
    });

    return { txHash };
  }
}
