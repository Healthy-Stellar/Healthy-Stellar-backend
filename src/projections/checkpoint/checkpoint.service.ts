import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectionCheckpoint } from './projection-checkpoint.entity';

@Injectable()
export class CheckpointService {
  constructor(
    @InjectRepository(ProjectionCheckpoint)
    private readonly repo: Repository<ProjectionCheckpoint>,
  ) {}

  async getVersion(projectorName: string): Promise<number> {
    const row = await this.repo.findOne({ where: { projectorName } });
    return row?.lastProcessedVersion ?? 0;
  }

  async advance(projectorName: string, version: number): Promise<void> {
    await this.repo
      .createQueryBuilder()
      .insert()
      .into(ProjectionCheckpoint)
      .values({
        projectorName,
        lastProcessedVersion: version,
        eventCount: () => '"event_count" + 1',
        updatedAt: new Date(),
      })
      .orUpdate(['last_processed_version', 'event_count', 'updated_at'], ['projector_name'])
      .execute();
  }

  async reset(projectorName: string): Promise<void> {
    await this.repo.upsert(
      {
        projectorName,
        lastProcessedVersion: 0,
        eventCount: 0,
        updatedAt: new Date(),
      },
      ['projectorName'],
    );
  }
}
