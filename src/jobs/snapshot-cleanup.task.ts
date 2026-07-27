import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { AggregateSnapshotEntity } from '../event-store/aggregate-snapshot.entity';

@Injectable()
export class SnapshotCleanupTask {
  private readonly logger = new Logger(SnapshotCleanupTask.name);

  constructor(
    @InjectRepository(AggregateSnapshotEntity)
    private readonly snapshotRepo: Repository<AggregateSnapshotEntity>,
    private readonly configService: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async pruneStaleSnapshots(): Promise<void> {
    const retainCount = this.configService.get<number>('SNAPSHOT_RETENTION_COUNT', 3);
    this.logger.log(`SnapshotCleanupTask: pruning snapshots, retaining latest ${retainCount} per aggregate`);

    // Get all distinct aggregate IDs that have more than retainCount snapshots
    const aggregates: { aggregate_id: string; total: string }[] = await this.snapshotRepo
      .createQueryBuilder('s')
      .select('s.aggregate_id', 'aggregate_id')
      .addSelect('COUNT(*)', 'total')
      .groupBy('s.aggregate_id')
      .having('COUNT(*) > :retainCount', { retainCount })
      .getRawMany();

    let deleted = 0;
    let errors = 0;

    for (const { aggregate_id } of aggregates) {
      try {
        // Find IDs to keep (latest retainCount by version)
        const toKeep = await this.snapshotRepo.find({
          where: { aggregateId: aggregate_id },
          order: { version: 'DESC' },
          take: retainCount,
          select: ['id'],
        });

        const keepIds = toKeep.map((s) => s.id);

        if (keepIds.length === 0) continue;

        const result = await this.snapshotRepo
          .createQueryBuilder()
          .delete()
          .where('aggregate_id = :aggregateId', { aggregateId: aggregate_id })
          .andWhere('id NOT IN (:...keepIds)', { keepIds })
          .execute();

        deleted += result.affected ?? 0;
      } catch (err) {
        errors++;
        this.logger.error(`SnapshotCleanupTask: error pruning aggregate ${aggregate_id}: ${err.message}`);
      }
    }

    this.logger.log(`SnapshotCleanupTask: done — deleted ${deleted} stale snapshots, errors: ${errors}`);
  }
}
