import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Logger } from '@nestjs/common';
import { AccessGrantedEvent, AccessRevokedEvent } from './domain-events';
import { CheckpointService } from '../checkpoint/checkpoint.service';

class AccessGrantReadModel {
  id: string;
  patientId: string;
  providerId: string;
  grantedBy: string;
  isActive: boolean;
  expiresAt: Date | null;
  grantedAt: Date;
  revokedAt: Date | null;
}

const PROJECTOR_NAME = 'AccessGrantProjector';

@EventsHandler(AccessGrantedEvent, AccessRevokedEvent)
export class AccessGrantProjector implements IEventHandler<
  AccessGrantedEvent | AccessRevokedEvent
> {
  private readonly logger = new Logger(AccessGrantProjector.name);

  constructor(
    @InjectRepository(AccessGrantReadModel)
    private readonly readRepo: Repository<AccessGrantReadModel>,
    private readonly checkpoints: CheckpointService,
    @InjectQueue('projection-dlq') private readonly dlq: Queue,
  ) {}

  async handle(event: AccessGrantedEvent | AccessRevokedEvent): Promise<void> {
    const lastVersion = await this.checkpoints.getVersion(PROJECTOR_NAME);

    if (event.version <= lastVersion) {
      return;
    }

    try {
      if (event instanceof AccessGrantedEvent) {
        await this.projectGranted(event);
      } else {
        await this.projectRevoked(event);
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

  private async projectGranted(event: AccessGrantedEvent): Promise<void> {
    await this.readRepo
      .createQueryBuilder()
      .insert()
      .into(AccessGrantReadModel)
      .values({
        id: event.grantId,
        patientId: event.patientId,
        providerId: event.providerId,
        grantedBy: event.grantedBy,
        isActive: true,
        expiresAt: event.expiresAt,
        grantedAt: event.occurredAt,
        revokedAt: null,
      })
      .orIgnore()
      .execute();
  }

  private async projectRevoked(event: AccessRevokedEvent): Promise<void> {
    await this.readRepo
      .createQueryBuilder()
      .update(AccessGrantReadModel)
      .set({ isActive: false, revokedAt: event.occurredAt })
      .where('id = :id AND is_active = true', { id: event.grantId })
      .execute();
  }
}
