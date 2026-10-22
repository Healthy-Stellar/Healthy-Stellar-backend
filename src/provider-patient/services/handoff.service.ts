import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CarePlanHandoff,
  HandoffStatus,
} from '../entities/care-plan-handoff.entity';
import { CreateHandoffDto, HandoffQueryDto } from '../dto/handoff.dto';
import { NotificationsService } from '../../notifications/services/notifications.service';

export interface HandoffActor {
  userId: string;
  tenantId: string;
}

@Injectable()
export class HandoffService {
  private readonly logger = new Logger(HandoffService.name);

  constructor(
    @InjectRepository(CarePlanHandoff)
    private readonly repo: Repository<CarePlanHandoff>,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(dto: CreateHandoffDto, actor: HandoffActor): Promise<CarePlanHandoff> {
    if (!actor?.tenantId) {
      throw new ForbiddenException('Caller is not associated with a tenant');
    }

    const target = await this.repo.manager
      .getRepository(CarePlanHandoff)
      .manager.query(
        `SELECT id FROM providers WHERE id = $1 AND "tenantId" = $2 LIMIT 1`,
        [dto.toProvider, actor.tenantId],
      )
      .catch(() => [] as Array<{ id: string }>);

    if (!Array.isArray(target) || target.length === 0) {
      throw new ForbiddenException(
        'Receiving provider does not belong to the caller\'s tenant',
      );
    }

    const handoff = this.repo.create({
      fromProvider: actor.userId,
      toProvider: dto.toProvider,
      patientId: dto.patientId,
      summary: dto.summary,
      pendingTasks: dto.pendingTasks ?? [],
      handoffTime: dto.handoffTime ? new Date(dto.handoffTime) : new Date(),
      status: HandoffStatus.PENDING,
      tenantId: actor.tenantId,
    });

    const saved = await this.repo.save(handoff);
    this.logger.log(
      `[handoff] Created id=${saved.id} from=${actor.userId} to=${dto.toProvider} patient=${dto.patientId} tenant=${actor.tenantId}`,
    );

    await this.notificationsService.sendProviderEmailNotification(
      dto.toProvider,
      'New patient handoff requires your attention',
      `Provider ${actor.userId} has handed off patient ${dto.patientId} to you. ` +
        `Review the handoff at /provider-patient/handoffs/${saved.id}. ` +
        `Please acknowledge within 30 minutes.`,
    );

    return saved;
  }

  async acknowledge(
    id: string,
    providerId: string,
    tenantId: string,
  ): Promise<CarePlanHandoff> {
    const handoff = await this.findOneOrFail(id, tenantId);

    if (handoff.toProvider !== providerId) {
      throw new ForbiddenException('Only the receiving provider may acknowledge this handoff');
    }

    handoff.status = HandoffStatus.ACKNOWLEDGED;
    handoff.acknowledgedAt = new Date();
    handoff.acknowledgedBy = providerId;

    const saved = await this.repo.save(handoff);
    this.logger.log(`[handoff] Acknowledged id=${id} by provider=${providerId}`);
    return saved;
  }

  async getPatientTimeline(
    patientId: string,
    tenantId: string,
  ): Promise<CarePlanHandoff[]> {
    return this.repo.find({
      where: { patientId, tenantId },
      order: { handoffTime: 'DESC' },
    });
  }

  async list(query: HandoffQueryDto, tenantId: string): Promise<CarePlanHandoff[]> {
    const where: Partial<CarePlanHandoff> = { tenantId };
    if (query.patientId) where.patientId = query.patientId;
    if (query.toProvider) where.toProvider = query.toProvider;
    return this.repo.find({
      where,
      order: { handoffTime: 'DESC' },
      take: query.limit ?? 20,
    });
  }

  async findOneOrFail(id: string, tenantId: string): Promise<CarePlanHandoff> {
    const handoff = await this.repo.findOne({ where: { id, tenantId } });
    if (!handoff) throw new NotFoundException(`Handoff ${id} not found`);
    return handoff;
  }

  /** Called by the scheduled escalation task every 5 minutes */
  async escalateStaleHandoffs(departmentHeadId: string): Promise<void> {
    const cutoff = new Date(Date.now() - 30 * 60 * 1000);

    const stale = await this.repo
      .createQueryBuilder('h')
      .where('h.status = :status', { status: HandoffStatus.PENDING })
      .andWhere('h.handoffTime < :cutoff', { cutoff })
      .andWhere('h.escalatedAt IS NULL')
      .getMany();

    for (const handoff of stale) {
      handoff.status = HandoffStatus.ESCALATED;
      handoff.escalatedAt = new Date();
      handoff.escalatedTo = departmentHeadId;
      await this.repo.save(handoff);

      this.logger.warn(
        `[handoff] Escalated id=${handoff.id} patient=${handoff.patientId} to department-head`,
      );

      await this.notificationsService.sendProviderEmailNotification(
        departmentHeadId,
        'Unacknowledged patient handoff requires escalation',
        `Handoff ${handoff.id} for patient ${handoff.patientId} has not been acknowledged ` +
          `within 30 minutes. Receiving provider: ${handoff.toProvider}. ` +
          `Review at /provider-patient/handoffs/${handoff.id}.`,
      );
    }
  }
}
