import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Logger } from '@nestjs/common';
import { RecordUploadedEvent, RecordAmendedEvent } from './domain-events';
import { CheckpointService } from '../checkpoint/checkpoint.service';
import { MedicalRecordReadModel } from '../entities/medical-record-read.entity';

const PROJECTOR_NAME = 'RecordProjector';

@EventsHandler(RecordUploadedEvent, RecordAmendedEvent)
export class RecordProjector implements IEventHandler<RecordUploadedEvent | RecordAmendedEvent> {
  private readonly logger = new Logger(RecordProjector.name);

  constructor(
    @InjectRepository(MedicalRecordReadModel)
    private readonly readRepo: Repository<MedicalRecordReadModel>,
    private readonly checkpoints: CheckpointService,
    @InjectQueue('projection-dlq') private readonly dlq: Queue,
  ) {}

  async handle(event: RecordUploadedEvent | RecordAmendedEvent): Promise<void> {
    const lastVersion = await this.checkpoints.getVersion(PROJECTOR_NAME);

    // Idempotency guard — skip already-processed versions
    if (event.version <= lastVersion) {
      this.logger.debug(`${PROJECTOR_NAME}: skipping already-projected version ${event.version}`);
      return;
    }

    try {
      if (event instanceof RecordUploadedEvent) {
        await this.projectUploaded(event);
      } else {
        await this.projectAmended(event);
      }

      await this.checkpoints.advance(PROJECTOR_NAME, event.version);
    } catch (err) {
      this.logger.error(`${PROJECTOR_NAME}: failed on version ${event.version} — ${err.message}`);
      await this.dlq.add(
        'projection-failed',
        { projectorName: PROJECTOR_NAME, event, error: err.message },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: true,
        },
      );
    }
  }

  private async projectUploaded(event: RecordUploadedEvent): Promise<void> {
    await this.readRepo
      .createQueryBuilder()
      .insert()
      .into(MedicalRecordReadModel)
      .values({
        aggregateId: event.recordId,
        patientId: event.patientId,
        cid: event.cid,
        recordType: event.recordType,
        uploadedBy: event.uploadedBy,
        version: 1,
        updatedAt: event.occurredAt,
      })
      .orIgnore() // idempotent: ignore duplicate inserts
      .execute();
  }

  private async projectAmended(event: RecordAmendedEvent): Promise<void> {
    await this.readRepo
      .createQueryBuilder()
      .update(MedicalRecordReadModel)
      .set({
        cid: event.newCid,
        version: event.newVersion,
        updatedAt: event.occurredAt,
      })
      .where('aggregate_id = :aggregateId AND version < :newVersion', {
        aggregateId: event.recordId,
        newVersion: event.newVersion,
      })
      .execute();
  }
}
