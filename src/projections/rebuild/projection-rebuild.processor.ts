import { Process, Processor, OnQueueFailed } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { ProjectionRebuildService } from './projection-rebuild.service';
import { CheckpointService } from '../checkpoint/checkpoint.service';
import { RebuildStatus } from '../dto/projection-status.dto';

interface RebuildJobData {
  projectorName: string;
}

// Stub interface — replace with actual EventStore service
interface EventStore {
  streamAll(fromVersion: number): AsyncGenerator<{ event: unknown; version: number }>;
  count(): Promise<number>;
}

@Processor('projection-rebuild')
export class ProjectionRebuildProcessor {
  private readonly logger = new Logger(ProjectionRebuildProcessor.name);

  constructor(
    private readonly rebuildService: ProjectionRebuildService,
    private readonly checkpoints: CheckpointService,
    private readonly eventBus: EventBus,
    @InjectQueue('projection-dlq') private readonly dlq: Queue,
    // TODO: inject actual EventStore
    // private readonly eventStore: EventStore,
  ) {}

  @Process('rebuild')
  async handleRebuild(job: Job<RebuildJobData>): Promise<void> {
    const { projectorName } = job.data;
    this.logger.log(`Starting rebuild for ${projectorName}`);

    try {
      // Reset checkpoint so the projector reprocesses from version 0
      await this.checkpoints.reset(projectorName);

      // TODO: replace stub with actual event store stream
      // const total = await this.eventStore.count();
      const total = 0;
      let processed = 0;

      await this.rebuildService.updateStatus(projectorName, {
        totalEvents: total,
        processedEvents: 0,
        progressPercent: 0,
      });

      // TODO: stream and republish events
      // for await (const { event, version } of this.eventStore.streamAll(0)) {
      //   await this.eventBus.publish(event as IEvent);
      //   processed++;
      //   if (processed % 100 === 0) {
      //     await this.rebuildService.updateStatus(projectorName, {
      //       processedEvents: processed,
      //       progressPercent: Math.floor((processed / total) * 100),
      //     });
      //   }
      // }

      await this.rebuildService.updateStatus(projectorName, {
        status: RebuildStatus.COMPLETED,
        processedEvents: processed,
        progressPercent: 100,
        completedAt: new Date().toISOString(),
      });

      this.logger.log(`Rebuild completed for ${projectorName}: ${processed} events processed`);
    } catch (err) {
      this.logger.error(`Rebuild failed for ${projectorName}: ${err.message}`);
      await this.rebuildService.updateStatus(projectorName, {
        status: RebuildStatus.FAILED,
        error: err.message,
        completedAt: new Date().toISOString(),
      });
      throw err;
    }
  }

  @OnQueueFailed()
  async onFailed(job: Job<RebuildJobData>, err: Error): Promise<void> {
    this.logger.error(
      `Rebuild job permanently failed for ${job.data.projectorName}: ${err.message}`,
    );
  }
}
