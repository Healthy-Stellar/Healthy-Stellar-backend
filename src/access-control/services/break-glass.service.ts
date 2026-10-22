import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { LessThanOrEqual, IsNull, Repository } from 'typeorm';
import {
  BreakGlassAccess,
  BreakGlassStatus,
} from '../entities/break-glass-access.entity';
import { AuditLogService } from '../../common/services/audit-log.service';
import { NotificationsService } from '../../notifications/services/notifications.service';

/** Default TTL for a break-glass session (configurable via env) */
const DEFAULT_BREAK_GLASS_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

/** Default SLA for supervisor review */
const DEFAULT_REVIEW_SLA_MS = 24 * 60 * 60 * 1000; // 24 hours

/** How often the unreviewed-report / expiry sweep runs */
const SWEEP_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

@Injectable()
export class BreakGlassService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BreakGlassService.name);

  private readonly ttlMs: number;
  private readonly reviewSlaMs: number;
  private sweepTimer: NodeJS.Timeout | null = null;

  constructor(
    @InjectRepository(BreakGlassAccess)
    private readonly breakGlassRepo: Repository<BreakGlassAccess>,
    private readonly configService: ConfigService,
    private readonly auditLogService: AuditLogService,
    private readonly notificationsService: NotificationsService,
  ) {
    this.ttlMs =
      this.configService.get<number>('BREAK_GLASS_TTL_MS') ?? DEFAULT_BREAK_GLASS_TTL_MS;
    this.reviewSlaMs =
      this.configService.get<number>('BREAK_GLASS_REVIEW_SLA_MS') ?? DEFAULT_REVIEW_SLA_MS;
  }

  onModuleInit(): void {
    this.sweepTimer = setInterval(() => this.runSweep(), SWEEP_INTERVAL_MS);
    this.logger.log(
      `BreakGlassService initialized: ttl=${this.ttlMs}ms, reviewSla=${this.reviewSlaMs}ms`,
    );
  }

  onModuleDestroy(): void {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = null;
    }
  }


  // ── Grant break-glass access ───────────────────────────────────────────────

  async grantBreakGlassAccess(
    granteeId: string,
    patientId: string,
    justification: string,
    clinicalContext?: string,
  ): Promise<BreakGlassAccess> {
    if (!justification || justification.trim().length < 20) {
      throw new BadRequestException(
        'Break-glass justification must be at least 20 characters',
      );
    }

    const existing = await this.breakGlassRepo.findOne({
      where: { granteeId, patientId, status: BreakGlassStatus.ACTIVE },
    });
    if (existing) {
      throw new BadRequestException(
        `An active break-glass session already exists (ID: ${existing.id}). Expires at ${existing.expiresAt.toISOString()}.`,
      );
    }

    const expiresAt = new Date(Date.now() + this.ttlMs);

    const access = this.breakGlassRepo.create({
      granteeId,
      patientId,
      justification: justification.trim(),
      clinicalContext: clinicalContext?.trim() ?? null,
      status: BreakGlassStatus.ACTIVE,
      expiresAt,
    });

    const saved = await this.breakGlassRepo.save(access);

    await this.auditLogService.log({
      entityType: 'BreakGlassAccess',
      entityId: saved.id,
      action: 'BREAK_GLASS_GRANTED',
      userId: granteeId,
      changes: {
        patientId,
        justification: justification.trim(),
        expiresAt: expiresAt.toISOString(),
      },
      metadata: {
        requiresReview: true,
        reviewSlaMs: this.reviewSlaMs,
        source: 'break-glass',
        severity: 'high',
      },
    });

    this.logger.warn(
      `BREAK-GLASS granted: grantee=${granteeId} patient=${patientId} expires=${expiresAt.toISOString()} id=${saved.id}`,
    );

    await this.notificationsService.sendPatientEmailNotification(
      patientId,
      'BREAK-GLASS ACCESS GRANTED - Requires Review',
      `Break-glass access was granted to user ${granteeId} for your records. Justification: ${justification}. This access must be reviewed by a supervisor within ${this.reviewSlaMs / (60 * 60 * 1000)} hours.`,
    );

    return saved;
  }

  async hasActiveBreakGlassAccess(granteeId: string, patientId: string): Promise<boolean> {
    const access = await this.breakGlassRepo.findOne({
      where: { granteeId, patientId, status: BreakGlassStatus.ACTIVE },
    });
    if (!access) return false;
    if (new Date() > access.expiresAt) {
      access.status = BreakGlassStatus.EXPIRED;
      await this.breakGlassRepo.save(access);
      return false;
    }
    return true;
  }

  async reviewBreakGlassAccess(
    accessId: string,
    reviewerId: string,
    reviewNotes: string,
    outcome: 'approved' | 'denied',
  ): Promise<BreakGlassAccess> {
    const access = await this.breakGlassRepo.findOne({ where: { id: accessId } });
    if (!access) throw new NotFoundException(`Break-glass access ${accessId} not found`);
    if (access.status !== BreakGlassStatus.ACTIVE && access.status !== BreakGlassStatus.EXPIRED) {
      throw new BadRequestException(`Break-glass access is already ${access.status.toLowerCase()}`);
    }

    access.reviewedBy = reviewerId;
    access.reviewedAt = new Date();
    access.reviewNotes = reviewNotes.trim();
    access.reviewOutcome = outcome;
    access.status = BreakGlassStatus.REVIEWED;

    const saved = await this.breakGlassRepo.save(access);

    await this.auditLogService.log({
      entityType: 'BreakGlassAccess',
      entityId: saved.id,
      action: `BREAK_GLASS_REVIEWED_${outcome.toUpperCase()}`,
      userId: reviewerId,
      changes: { originalGranteeId: access.granteeId, outcome },
      metadata: { source: 'break-glass-review', severity: outcome === 'denied' ? 'critical' : 'info' },
    });

    this.logger.log(`Break-glass ${saved.id} reviewed by ${reviewerId}: ${outcome}`);
    return saved;
  }

  async getUnreviewedAccesses(includeWithinSla = false): Promise<BreakGlassAccess[]> {
    const where: any = { status: BreakGlassStatus.ACTIVE, reviewedBy: IsNull() };
    if (!includeWithinSla) {
      where.createdAt = LessThanOrEqual(new Date(Date.now() - this.reviewSlaMs));
    }
    return this.breakGlassRepo.find({ where, order: { createdAt: 'DESC' } });
  }

  async getBreachOfSlaAccesses(): Promise<BreakGlassAccess[]> {
    return this.breakGlassRepo.find({
      where: {
        status: BreakGlassStatus.ACTIVE,
        reviewedBy: IsNull(),
        createdAt: LessThanOrEqual(new Date(Date.now() - this.reviewSlaMs)),
      },
      order: { createdAt: 'DESC' },
    });
  }

  async runSweep(): Promise<{ expired: number; slaBreaches: number }> {
    const expireResult = await this.breakGlassRepo.update(
      { status: BreakGlassStatus.ACTIVE, expiresAt: LessThanOrEqual(new Date()) },
      { status: BreakGlassStatus.EXPIRED },
    );
    const expired = expireResult.affected ?? 0;

    const slaBreaches = await this.getBreachOfSlaAccesses();
    for (const breach of slaBreaches) {
      await this.auditLogService.log({
        entityType: 'BreakGlassAccess',
        entityId: breach.id,
        action: 'BREAK_GLASS_SLA_BREACH',
        userId: breach.granteeId,
        changes: { patientId: breach.patientId, slaHours: this.reviewSlaMs / (60 * 60 * 1000) },
        metadata: { source: 'break-glass-sweep', severity: 'critical' },
      });
    }
    if (expired > 0 || slaBreaches.length > 0) {
      this.logger.log(`Sweep: expired=${expired} slaBreaches=${slaBreaches.length}`);
    }
    return { expired, slaBreaches: slaBreaches.length };
  }

  async getAllForPatient(patientId: string): Promise<BreakGlassAccess[]> {
    return this.breakGlassRepo.find({ where: { patientId }, order: { createdAt: 'DESC' } });
  }

  async getAllForGrantee(granteeId: string): Promise<BreakGlassAccess[]> {
    return this.breakGlassRepo.find({ where: { granteeId }, order: { createdAt: 'DESC' } });
  }

  async revokeAccess(accessId: string, revokedBy: string, reason: string): Promise<BreakGlassAccess> {
    const access = await this.breakGlassRepo.findOne({ where: { id: accessId } });
    if (!access) throw new NotFoundException(`Break-glass access ${accessId} not found`);

    access.status = BreakGlassStatus.REVOKED;
    access.reviewedBy = revokedBy;
    access.reviewedAt = new Date();
    access.reviewNotes = reason.trim();
    const saved = await this.breakGlassRepo.save(access);

    await this.auditLogService.log({
      entityType: 'BreakGlassAccess',
      entityId: saved.id,
      action: 'BREAK_GLASS_REVOKED',
      userId: revokedBy,
      changes: { originalGranteeId: access.granteeId, reason: reason.trim() },
      metadata: { source: 'break-glass-admin', severity: 'high' },
    });
    return saved;
  }
}
