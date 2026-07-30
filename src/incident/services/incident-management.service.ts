import { Injectable, Logger, NotFoundException } from '@nestjs/common';
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
  ResolveIncidentManagementDto,
} from '../dto/incident-management.dto';
import { NotificationsService } from '../../notifications/services/notifications.service';

@Injectable()
export class IncidentManagementService {
  private readonly logger = new Logger(IncidentManagementService.name);

  constructor(
    @InjectRepository(Incident)
    private readonly repo: Repository<Incident>,
    private readonly notificationsService: NotificationsService,
  ) {}

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

  async acknowledge(
    id: string,
    dto: AcknowledgeIncidentDto,
    responderId: string,
  ): Promise<Incident> {
    const incident = await this.findOneOrFail(id);
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

  async resolve(
    id: string,
    dto: ResolveIncidentManagementDto,
    responderId: string,
  ): Promise<Incident> {
    const incident = await this.findOneOrFail(id);
    incident.state = IncidentState.RESOLVED;
    incident.resolvedAt = new Date();
    if (!incident.firstResponseAt) {
      incident.firstResponseAt = new Date();
    }
    incident.metadata = {
      ...incident.metadata,
      resolveNotes: dto.notes,
      resolvedBy: responderId,
    };
    return this.repo.save(incident);
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
