import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventBus } from '@nestjs/cqrs';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { EventEntity } from '../../event-store/event.entity';
import { ProjectionCheckpoint } from '../entities/projection-checkpoint.entity';
import { DomainEventPublished } from '../domain-event-published.event';

export const PROJECTION_REBUILD_QUEUE = 'projection-rebuild';

export interface RebuildStatus {
  projectorName: string;
  status: 'idle' | 'running' | 'done' | 'failed';
  processedEvents: number;
  totalEvents: number;
  startedAt?: Date;
  finishedAt?: Date;
  error?: string;
}

const KNOWN_PROJECTORS = [
  'RecordProjector',
  'AccessGrantProjector',
  'AuditProjector',
  'AnalyticsProjector',
];

@Injectable()
export class ProjectionRebuildService {
  private readonly logger = new Logger(ProjectionRebuildService.name);
  private readonly statusMap = new Map<string, RebuildStatus>();

  constructor(
    @InjectRepository(EventEntity)
    private readonly eventRepo: Repository<EventEntity>,
    @InjectRepository(ProjectionCheckpoint)
    private readonly checkpointRepo: Repository<ProjectionCheckpoint>,
    private readonly eventBus: EventBus,
    @InjectQueue(PROJECTION_REBUILD_QUEUE)
    private readonly rebuildQueue: Queue,
  ) {}

  getStatus(projectorName: string): RebuildStatus {
    this.assertKnown(projectorName);
    return (
      this.statusMap.get(projectorName) ?? {
        projectorName,
        status: 'idle',
        processedEvents: 0,
        totalEvents: 0,
      }
    );
  }

  async enqueueRebuild(projectorName: string): Promise<void> {
    this.assertKnown(projectorName);
    await this.rebuildQueue.add('rebuild', { projectorName }, { attempts: 3 });
    this.statusMap.set(projectorName, {
      projectorName,
      status: 'running',
      processedEvents: 0,
      totalEvents: 0,
      startedAt: new Date(),
    });
  }

  /** Called by the BullMQ processor — replays all events through the projector. */
  async runRebuild(projectorName: string): Promise<void> {
    this.assertKnown(projectorName);
    const status = this.statusMap.get(projectorName) ?? {
      projectorName,
      status: 'running' as const,
      processedEvents: 0,
      totalEvents: 0,
      startedAt: new Date(),
    };
    this.statusMap.set(projectorName, { ...status, status: 'running', startedAt: new Date() });

    try {
      // Reset checkpoint so projectors start from scratch
      await this.checkpointRepo.upsert(
        { projectorName, lastProcessedVersion: 0 },
        ['projectorName'],
      );

      const total = await this.eventRepo.count();
      this.statusMap.set(projectorName, { ...status, status: 'running', totalEvents: total });

      const batchSize = 100;
      let offset = 0;
      let processed = 0;

      while (offset < total) {
        const rows = await this.eventRepo.find({
          order: { occurredAt: 'ASC' },
          skip: offset,
          take: batchSize,
        });

        for (const row of rows) {
          const domainEvent = {
            eventType: row.eventType,
            aggregateId: row.aggregateId,
            aggregateType: row.aggregateType,
            payload: row.payload,
            metadata: row.metadata,
            version: row.version,
          };
          this.eventBus.publish(new DomainEventPublished(domainEvent, ++processed));
        }

        offset += batchSize;
        this.statusMap.set(projectorName, {
          ...status,
          status: 'running',
          processedEvents: processed,
          totalEvents: total,
        });
      }

      this.statusMap.set(projectorName, {
        projectorName,
        status: 'done',
        processedEvents: processed,
        totalEvents: total,
        startedAt: status.startedAt,
        finishedAt: new Date(),
      });
      this.logger.log(`Rebuild of ${projectorName} complete — ${processed} events replayed`);
    } catch (err: any) {
      this.statusMap.set(projectorName, {
        ...this.statusMap.get(projectorName)!,
        status: 'failed',
        error: err.message,
        finishedAt: new Date(),
      });
      throw err;
    }
  }

  private assertKnown(name: string): void {
    if (!KNOWN_PROJECTORS.includes(name)) {
      throw new NotFoundException(`Unknown projector: ${name}`);
    }
  }
}
