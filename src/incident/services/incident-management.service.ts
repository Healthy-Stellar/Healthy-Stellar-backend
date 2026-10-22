import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import {
  Incident,
  IncidentPriority,
  IncidentState,
  SLA_MINUTES,
} from '../entities/incident.entity';
import {
  AcknowledgeIncidentDto,
  CreateIncidentDto,
  IncidentManagementQueryDto,
  IncidentSlaReportQueryDto,
  ReopenIncidentDto,
  ResolveIncidentManagementDto,
} from '../dto/incident-management.dto';
import { NotificationsService } from '../../notifications/services/notifications.service';

/**
 * Valid state transitions for the incident state machine:
 *   OPEN → ACKNOWLEDGED
 *   ACKNOWLEDGED → RESOLVED
 *   RESOLVED → OPEN  (reopen)
 *
 * IN_PROGRESS is a legacy value kept in the enum for backward compatibility
 * but is not part of the enforced flow.
 */
const ALLOWED_TRANSITIONS: Partial<Record<IncidentState, IncidentState>> = {
  [IncidentState.OPEN]: IncidentState.ACKNOWLEDGED,
  [IncidentState.ACKNOWLEDGED]: IncidentState.RESOLVED,
  [IncidentState.RESOLVED]: IncidentState.OPEN, // reopen
};

@Injectable()
export class IncidentManagementService {
  private readonly logger = new Logger(IncidentManagementService.name);

  constructor(
    @InjectRepository(Incident)
    private readonly repo: Repository<Incident>,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Assert that transitioning `incident` to `next` is permitted.
   * Throws ConflictException (HTTP 409) when the transition is illegal.
   */
  private assertTransition(incident: Incident, next: IncidentState): void {
    const allowed = ALLOWED_TRANSITIONS[incident.state];
    if (allowed !== next) {
      throw new ConflictException(
        `Cannot transition incident from '${incident.state}' to '${next}'. ` +
          `Allowed transition from '${incident.state}': '${allowed ?? 'none'}'.`,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  async create(dto: CreateIncidentDto): Promise<Incident> {
    const incident = this.repo.create({
      title: dto.title,
      description: dto.description,
      priority: dto.priority,
      assignedTo: dto.assignedTo,
      state: IncidentState.OPEN,
      metadata: dto.metadata,
    });
    const saved = await this.repo.save(incident);
    this.logger.warn(
      `[incident] Created ${saved.priority} incident id=${saved.id}: ${saved.title}`,
    );
    return saved;
  }

  /**
   * Acknowledge an incident.
   * Only valid when the incident is currently OPEN.
   * Sets firstResponseAt on the first call (idempotent for subsequent calls
   * on the same incident if re-tried before a transition away).
   */
  async acknowledge(
    id: string,
    dto: AcknowledgeIncidentDto,
    responderId: string,
  ): Promise<Incident> {
    const incident = await this.findOneOrFail(id);
    this.assertTransition(incident, IncidentState.ACKNOWLEDGED);

    if (!incident.firstResponseAt) {
      incident.firstResponseAt = new Date();
    }
    incident.state = IncidentState.ACKNOWLEDGED;
    incident.metadata = {
      ...incident.metadata,
      acknowledgeNotes: dto.notes,
      acknowledgedBy: responderId,
    };
    const saved = await this.repo.save(incident);
    this.logger.log(`[incident] ${id} acknowledged by ${responderId}`);
    return saved;
  }

  /**
   * Resolve an incident.
   * Only valid when the incident is currently ACKNOWLEDGED.
   * Sets resolvedAt exactly once — it is NOT overwritten on a re-resolve
   * attempt because that attempt will be rejected by assertTransition before
   * reaching this point.
   */
  async resolve(
    id: string,
    dto: ResolveIncidentManagementDto,
    responderId: string,
  ): Promise<Incident> {
    const incident = await this.findOneOrFail(id);
    this.assertTransition(incident, IncidentState.RESOLVED);

    incident.state = IncidentState.RESOLVED;
    incident.resolvedAt = new Date();
    if (!incident.firstResponseAt) {
      // safety net: should never reach here without firstResponseAt set, but
      // record it anyway to avoid null in analytics queries.
      incident.firstResponseAt = new Date();
    }
    incident.metadata = {
      ...incident.metadata,
      resolveNotes: dto.notes,
      resolvedBy: responderId,
    };
    const saved = await this.repo.save(incident);
    this.logger.log(`[incident] ${id} resolved by ${responderId}`);
    return saved;
  }

  /**
   * Reopen a resolved incident.
   * Only valid when the incident is currently RESOLVED.
   * Clears resolvedAt so it does not re-enter the SLA escalation loop with
   * stale timestamps.
   */
  async reopen(
    id: string,
    dto: ReopenIncidentDto,
    responderId: string,
  ): Promise<Incident> {
    const incident = await this.findOneOrFail(id);
    this.assertTransition(incident, IncidentState.OPEN);

    incident.state = IncidentState.OPEN;
    incident.resolvedAt = null;
    // Reset SLA tracking so the escalation scheduler treats it as a fresh incident.
    incident.slaBreach = false;
    incident.escalationLevel = 0;
    incident.lastEscalatedAt = null;
    incident.metadata = {
      ...incident.metadata,
      reopenNotes: dto.notes,
      reopenedBy: responderId,
    };
    const saved = await this.repo.save(incident);
    this.logger.warn(`[incident] ${id} reopened by ${responderId}`);
    return saved;
  }

  async list(query: IncidentManagementQueryDto): Promise<Incident[]> {
    const where: Partial<Incident> = {};
    if (query.priority) where.priority = query.priority;
    if (query.state) where.state = query.state;
    return this.repo.find({
      where,
      order: { createdAt: 'DESC' },
      take: query.limit ?? 20,
    });
  }

  async findOneOrFail(id: string): Promise<Incident> {
    const incident = await this.repo.findOne({ where: { id } });
    if (!incident) throw new NotFoundException(`Incident ${id} not found`);
    return incident;
  }

  async getSlaReport(query: IncidentSlaReportQueryDto) {
    const from = new Date(query.from);
    const to = new Date(query.to);

    const incidents = await this.repo.find({
      where: { createdAt: Between(from, to) },
    });

    const byPriority: Record<
      string,
      {
        total: number;
        breached: number;
        compliant: number;
        avgResponseMinutes: number | null;
      }
    > = {};

    for (const p of Object.values(IncidentPriority)) {
      const group = incidents.filter((i) => i.priority === p);
      const breached = group.filter((i) => i.slaBreach).length;
      const withResponse = group.filter((i) => i.firstResponseAt);
      const avgMs =
        withResponse.length > 0
          ? withResponse.reduce(
              (sum, i) =>
                sum + (i.firstResponseAt.getTime() - i.createdAt.getTime()),
              0,
            ) / withResponse.length
          : null;

      byPriority[p] = {
        total: group.length,
        breached,
        compliant: group.length - breached,
        avgResponseMinutes: avgMs != null ? Math.round(avgMs / 60000) : null,
      };
    }

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      totalIncidents: incidents.length,
      byPriority,
    };
  }

  /** Called by the scheduled task every 5 minutes */
  async checkAndEscalateSlaBreaches(): Promise<void> {
    const now = new Date();
    const openIncidents = await this.repo.find({
      where: { state: In([IncidentState.OPEN, IncidentState.ACKNOWLEDGED]) },
    });

    for (const incident of openIncidents) {
      const slaMinutes = SLA_MINUTES[incident.priority];
      const elapsedMinutes =
        (now.getTime() - incident.createdAt.getTime()) / 60000;

      if (elapsedMinutes < slaMinutes) continue;

      const nextEscalationThreshold = slaMinutes * (incident.escalationLevel + 1);
      const shouldEscalate =
        !incident.slaBreach || elapsedMinutes >= nextEscalationThreshold;

      if (!shouldEscalate) continue;

      incident.slaBreach = true;
      incident.escalationLevel += 1;
      incident.lastEscalatedAt = now;
      await this.repo.save(incident);

      const recipient =
        incident.escalationLevel > 1
          ? 'department-head'
          : (incident.assignedTo ?? 'department-head');

      this.logger.warn(
        `[incident-sla] Breach! id=${incident.id} priority=${incident.priority} ` +
          `elapsed=${Math.round(elapsedMinutes)}min sla=${slaMinutes}min level=${incident.escalationLevel}`,
      );

      await this.notificationsService.sendProviderEmailNotification(
        recipient,
        `SLA Breach L${incident.escalationLevel}: [${incident.priority}] ${incident.title}`,
        `Incident ${incident.id} (${incident.priority}) has breached its ${slaMinutes}-minute SLA. ` +
          `Elapsed: ${Math.round(elapsedMinutes)} minutes. Escalation level: ${incident.escalationLevel}.`,
      );
    }
  }
}
