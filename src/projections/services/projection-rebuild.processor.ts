import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ProjectionRebuildService, PROJECTION_REBUILD_QUEUE } from '../services/projection-rebuild.service';

@Processor(PROJECTION_REBUILD_QUEUE)
export class ProjectionRebuildProcessor extends WorkerHost {
  private readonly logger = new Logger(ProjectionRebuildProcessor.name);

  constructor(private readonly rebuildService: ProjectionRebuildService) {
    super();
  }

  async process(job: Job<{ projectorName: string }>): Promise<void> {
    await this.rebuildService.runRebuild(job.data.projectorName);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<{ projectorName: string }>, err: Error): void {
    const attempts = job.attemptsMade;
    this.logger.error(
      `Projection rebuild failed for ${job.data.projectorName} (attempt ${attempts}): ${err.message}`,
    );
    // Alert after 3 failures (job moves to dead-letter queue automatically via BullMQ)
    if (attempts >= 3) {
      this.logger.error(
        `[ALERT] Projector ${job.data.projectorName} has failed ${attempts} times and moved to DLQ`,
      );
    }
  }
}
