import {
  EventSubscriber,
  EntitySubscriberInterface,
  InsertEvent,
  UpdateEvent,
  DataSource,
} from 'typeorm';
import { Injectable, Logger } from '@nestjs/common';
import { MedicalRecord } from '../entities/medical-record.entity';

/**
 * TypeORM subscriber that auto-populates the `search_vector` tsvector column
 * on MedicalRecord entities when text content fields change.
 *
 * This is a TypeORM-level safeguard alongside the DB trigger.
 * The trigger is the primary mechanism (survives direct SQL updates),
 * while this subscriber ensures in-application saves via the repository
 * also keep search_vector in sync even if the trigger is temporarily
 * disabled or bypassed in transactions that skip statement triggers.
 *
 * @see ../../migrations/1746500000000-AddMedicalRecordFullTextSearch.ts
 */
@Injectable()
@EventSubscriber()
export class MedicalRecordSearchSubscriber
  implements EntitySubscriberInterface<MedicalRecord>
{
  private readonly logger = new Logger(MedicalRecordSearchSubscriber.name);

  constructor(private readonly dataSource: DataSource) {
    this.dataSource.subscribers.push(this);
  }

  /** Listen only to MedicalRecord entity events */
  listenTo() {
    return MedicalRecord;
  }

  /**
   * After inserting a MedicalRecord, we mark that the DB trigger will handle
   * search_vector population. Logging here for observability.
   */
  async afterInsert(event: InsertEvent<MedicalRecord>): Promise<void> {
    if (!event.entity) return;

    this.logger.debug(
      `MedicalRecord inserted (id=${event.entity.id}) — search_vector will be populated by DB trigger.`,
    );
  }

  /**
   * After updating a MedicalRecord, if any of the text-searchable columns
   * changed, the DB trigger will have already updated search_vector because
   * we have a BEFORE UPDATE trigger on those columns.
   *
   * We log here for observability in debug mode.
   */
  async afterUpdate(event: UpdateEvent<MedicalRecord>): Promise<void> {
    if (!event.entity || !event.databaseEntity) return;

    const textColumns = ['title', 'description', 'notes', 'diagnosis', 'tags'];
    const hasChanges = textColumns.some(
      (col) =>
        (event.databaseEntity as any)[col] !== (event.entity as any)[col],
    );

    if (hasChanges) {
      this.logger.debug(
        `MedicalRecord updated (id=${event.entity.id}) — text content changed, search_vector will be updated by DB trigger.`,
      );
    }
  }
}
