import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Logger } from '@nestjs/common';
import { RecordUploadedEvent, RecordAmendedEvent } from './domain-events';
import { CheckpointService } from '../checkpoint/checkpoint.service';

// Stub entity — replace with actual MedicalRecord read-model entity
class MedicalRecordReadModel {
  id: string;
  patientId: string;
  cid: string;
  recordType: string;
  uploadedBy: string;
  latestVersion: number;
  updatedAt: Date;
}

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
        id: event.recordId,
        patientId: event.patientId,
        cid: event.cid,
        recordType: event.recordType,
        uploadedBy: event.uploadedBy,
        latestVersion: 1,
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
        latestVersion: event.newVersion,
        updatedAt: event.occurredAt,
      })
      .where('id = :id AND latest_version < :newVersion', {
        id: event.recordId,
        newVersion: event.newVersion,
      })
      .execute();
  }
}
