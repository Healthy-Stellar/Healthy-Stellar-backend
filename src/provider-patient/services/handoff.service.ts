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

/**
 * Resolves the escalation target for a handoff's tenant/department.
 * Implementations should look up the department head or charge nurse for the
 * given tenant/department and return their provider id, or null if none is
 * configured.
 */
export type EscalationTargetResolver = (
  tenantId: string | null | undefined,
  departmentId: string | null | undefined,
) => Promise<string | null>;

@Injectable()
export class HandoffService {
  private readonly logger = new Logger(HandoffService.name);

  constructor(
    @InjectRepository(CarePlanHandoff)
    private readonly repo: Repository<CarePlanHandoff>,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(dto: CreateHandoffDto): Promise<CarePlanHandoff> {
    const handoff = this.repo.create({
      fromProvider: dto.fromProvider,
      toProvider: dto.toProvider,
      patientId: dto.patientId,
      summary: dto.summary,
      pendingTasks: dto.pendingTasks ?? [],
      handoffTime: dto.handoffTime ? new Date(dto.handoffTime) : new Date(),
      status: HandoffStatus.PENDING,
    });

    const saved = await this.repo.save(handoff);
    this.logger.log(
      `[handoff] Created id=${saved.id} from=${dto.fromProvider} to=${dto.toProvider} patient=${dto.patientId}`,
    );

    await this.notificationsService.sendProviderEmailNotification(
      dto.toProvider,
      'New patient handoff requires your attention',
      `Provider ${dto.fromProvider} has handed off patient ${dto.patientId} to you. ` +
        `Summary: ${dto.summary}. Please acknowledge within 30 minutes.`,
    );

    return saved;
  }

  async acknowledge(id: string, providerId: string): Promise<CarePlanHandoff> {
    const handoff = await this.findOneOrFail(id);

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

  async getPatientTimeline(patientId: string): Promise<CarePlanHandoff[]> {
    return this.repo.find({
      where: { patientId },
      order: { handoffTime: 'DESC' },
    });
  }

  async list(query: HandoffQueryDto): Promise<CarePlanHandoff[]> {
    const where: Partial<CarePlanHandoff> = {};
    if (query.patientId) where.patientId = query.patientId;
    if (query.toProvider) where.toProvider = query.toProvider;
    return this.repo.find({
      where,
      order: { handoffTime: 'DESC' },
      take: query.limit ?? 20,
    });
  }

  async findOneOrFail(id: string): Promise<CarePlanHandoff> {
    const handoff = await this.repo.findOne({ where: { id } });
    if (!handoff) throw new NotFoundException(`Handoff ${id} not found`);
    return handoff;
  }

  /**
   * Called by the scheduled escalation task every 5 minutes.
   *
   * Each stale handoff is claimed atomically via `UPDATE ... RETURNING` so that
   * only one instance escalates it, and the escalation target is resolved per
   * tenant/department. A handoff is marked ESCALATED only after the
   * notification is accepted; if no target is configured the handoff is left
   * untouched and an error is logged so the misconfiguration is visible.
   */
  async escalateStaleHandoffs(
    resolveTarget: EscalationTargetResolver,
  ): Promise<void> {
    const cutoff = new Date(Date.now() - 30 * 60 * 1000);

    const stale = await this.repo
      .createQueryBuilder('h')
      .where('h.status = :status', { status: HandoffStatus.PENDING })
      .andWhere('h.handoffTime < :cutoff', { cutoff })
      .andWhere('h.escalatedAt IS NULL')
      .getMany();

    for (const candidate of stale) {
      // Atomically claim the handoff so concurrent instances skip it.
      const claim = await this.repo
        .createQueryBuilder()
        .update(CarePlanHandoff)
        .set({ escalatedAt: new Date() })
        .where('id = :id', { id: candidate.id })
        .andWhere('status = :status', { status: HandoffStatus.PENDING })
        .andWhere('escalatedAt IS NULL')
        .returning(['id'])
        .execute();

      if (!claim.raw || claim.raw.length === 0) {
        // Another instance already claimed this handoff.
        continue;
      }

      const target = await resolveTarget(
        (candidate as any).tenantId,
        (candidate as any).departmentId,
      );

      if (!target) {
        this.logger.error(
          `[handoff] No escalation target configured for tenant=${(candidate as any).tenantId} ` +
            `department=${(candidate as any).departmentId}; handoff id=${candidate.id} left unescalated`,
        );
        // Release the claim so a later run can retry once configured.
        await this.repo
          .createQueryBuilder()
          .update(CarePlanHandoff)
          .set({ escalatedAt: null })
          .where('id = :id', { id: candidate.id })
          .andWhere('status = :status', { status: HandoffStatus.PENDING })
          .execute();
        continue;
      }

      try {
        await this.notificationsService.sendProviderEmailNotification(
          target,
          'Unacknowledged patient handoff requires escalation',
          `Handoff ${candidate.id} for patient ${candidate.patientId} has not been acknowledged ` +
            `within 30 minutes. Receiving provider: ${candidate.toProvider}.`,
        );
      } catch (err) {
        this.logger.error(
          `[handoff] Failed to notify escalation target=${target} for id=${candidate.id}: ${(err as Error).message}`,
        );
        // Release the claim so the handoff can be retried on the next run.
        await this.repo
          .createQueryBuilder()
          .update(CarePlanHandoff)
          .set({ escalatedAt: null })
          .where('id = :id', { id: candidate.id })
          .andWhere('status = :status', { status: HandoffStatus.PENDING })
          .execute();
        continue;
      }

      // Notification accepted: finalize the escalation.
      await this.repo
        .createQueryBuilder()
        .update(CarePlanHandoff)
        .set({
          status: HandoffStatus.ESCALATED,
          escalatedAt: new Date(),
          escalatedTo: target,
        })
        .where('id = :id', { id: candidate.id })
        .andWhere('status = :status', { status: HandoffStatus.PENDING })
        .execute();

      this.logger.warn(
        `[handoff] Escalated id=${candidate.id} patient=${candidate.patientId} to=${target}`,
      );
    }
  }
}
