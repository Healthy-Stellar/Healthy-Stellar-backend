import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  IncidentEvidenceEntity,
  IncidentSeverity,
  IncidentStatus,
} from './entities/incident-evidence.entity';
import {
  CaptureIncidentDto,
  IncidentQueryDto,
  ResolveIncidentDto,
  UpdateIncidentNotesDto,
} from './dto/incident.dto';
import { TracingService } from '../common/services/tracing.service';
import { QUEUE_NAMES } from '../queues/queue.constants';
import { getRecentLogs } from './incident-log.buffer';

/**
 * IncidentEvidenceService
 *
 * Captures a structured evidence bundle at the moment a severe incident is
 * declared. The bundle includes:
 *
 *  - Process memory & CPU snapshot (RSS, heap, CPU user/sys)
 *  - BullMQ queue depths for every registered queue
 *  - Last 50 structured log entries from the in-memory ring buffer
 *  - Active OTel trace context for correlation with Jaeger/Tempo
 *  - Caller-supplied metadata (job IDs, patient IDs, queue names, etc.)
 *
 * All evidence is persisted to `incident_evidence` so it survives restarts
 * and can be queried by operators via the REST API.
 */
@Injectable()
export class IncidentEvidenceService {
  private readonly logger = new Logger(IncidentEvidenceService.name);

  /** Map of queue name → injected Queue instance for depth snapshots */
  private readonly queues: Map<string, Queue>;

  constructor(
    @InjectRepository(IncidentEvidenceEntity)
    private readonly repo: Repository<IncidentEvidenceEntity>,

    private readonly tracingService: TracingService,

    @InjectQueue(QUEUE_NAMES.STELLAR_TRANSACTIONS)
    private readonly stellarQueue: Queue,
    @InjectQueue(QUEUE_NAMES.CONTRACT_WRITES)
    private readonly contractWritesQueue: Queue,
    @InjectQueue(QUEUE_NAMES.IPFS_UPLOADS)
    private readonly ipfsQueue: Queue,
    @InjectQueue(QUEUE_NAMES.EVENT_INDEXING)
    private readonly eventIndexingQueue: Queue,
    @InjectQueue(QUEUE_NAMES.EMAIL_NOTIFICATIONS)
    private readonly emailQueue: Queue,
    @InjectQueue(QUEUE_NAMES.REPORTS)
    private readonly reportsQueue: Queue,
    @InjectQueue(QUEUE_NAMES.EHR_IMPORT)
    private readonly ehrImportQueue: Queue,
  ) {
    this.queues = new Map([
      [QUEUE_NAMES.STELLAR_TRANSACTIONS, this.stellarQueue],
      [QUEUE_NAMES.CONTRACT_WRITES, this.contractWritesQueue],
      [QUEUE_NAMES.IPFS_UPLOADS, this.ipfsQueue],
      [QUEUE_NAMES.EVENT_INDEXING, this.eventIndexingQueue],
      [QUEUE_NAMES.EMAIL_NOTIFICATIONS, this.emailQueue],
      [QUEUE_NAMES.REPORTS, this.reportsQueue],
      [QUEUE_NAMES.EHR_IMPORT, this.ehrImportQueue],
    ]);
  }

  /**
   * Capture a full evidence bundle and persist it.
   * Call this as soon as an incident is detected — the snapshot is point-in-time.
   */
  async capture(dto: CaptureIncidentDto): Promise<IncidentEvidenceEntity> {
    const [memorySnapshot, cpuSnapshot, queueSnapshot, recentLogs, traceContext] =
      await Promise.all([
        this.snapshotMemory(),
        this.snapshotCpu(),
        this.snapshotQueues(),
        Promise.resolve(getRecentLogs(50)),
        Promise.resolve(this.tracingService.getCurrentTraceContext()),
      ]);

    const entity = this.repo.create({
      title: dto.title,
      description: dto.description,
      severity: dto.severity ?? IncidentSeverity.HIGH,
      status: IncidentStatus.OPEN,
      triggeredBy: dto.triggeredBy,
      traceId: traceContext.traceId,
      memorySnapshot,
      cpuSnapshot,
      queueSnapshot,
      recentLogs,
      traceContext,
      metadata: dto.metadata,
    });

    const saved = await this.repo.save(entity);

    this.logger.warn(
      `[incident] Evidence captured — id=${saved.id} severity=${saved.severity} ` +
      `rss=${memorySnapshot.rss}MB title="${saved.title}"`,
    );

    return saved;
  }

  async list(query: IncidentQueryDto): Promise<IncidentEvidenceEntity[]> {
    const where: Partial<IncidentEvidenceEntity> = {};
    if (query.severity) where.severity = query.severity;
    if (query.status) where.status = query.status;

    return this.repo.find({
      where,
      order: { capturedAt: 'DESC' },
      take: query.limit ?? 20,
    });
  }

  async get(id: string): Promise<IncidentEvidenceEntity> {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException(`Incident evidence ${id} not found`);
    return entity;
  }

  async resolve(id: string, dto: ResolveIncidentDto, resolvedBy: string): Promise<IncidentEvidenceEntity> {
    const entity = await this.get(id);
    entity.status = IncidentStatus.RESOLVED;
    entity.resolvedAt = new Date();
    entity.resolvedBy = resolvedBy;
    if (dto.notes) {
      entity.notes = entity.notes ? `${entity.notes}\n${dto.notes}` : dto.notes;
    }
    const saved = await this.repo.save(entity);
    this.logger.log(`[incident] Evidence ${id} resolved by ${resolvedBy}`);
    return saved;
  }

  async addNotes(id: string, dto: UpdateIncidentNotesDto): Promise<IncidentEvidenceEntity> {
    const entity = await this.get(id);
    entity.notes = entity.notes ? `${entity.notes}\n${dto.notes}` : dto.notes;
    entity.status = IncidentStatus.INVESTIGATING;
    return this.repo.save(entity);
  }

  // ── Private snapshot helpers ──────────────────────────────────────────────

  private snapshotMemory() {
    const m = process.memoryUsage();
    const mb = (bytes: number) => Math.round(bytes / 1024 / 1024);
    return Promise.resolve({
      rss: mb(m.rss),
      heapUsed: mb(m.heapUsed),
      heapTotal: mb(m.heapTotal),
      external: mb(m.external),
      arrayBuffers: mb(m.arrayBuffers),
    });
  }

  private snapshotCpu() {
    const c = process.cpuUsage();
    return Promise.resolve({ user: c.user, system: c.system });
  }

  private async snapshotQueues(): Promise<
    Record<string, { waiting: number; active: number; failed: number; delayed: number }>
  > {
    const snapshot: Record<string, { waiting: number; active: number; failed: number; delayed: number }> = {};

    await Promise.all(
      Array.from(this.queues.entries()).map(async ([name, queue]) => {
        try {
          const [waiting, active, failed, delayed] = await Promise.all([
            queue.getWaitingCount(),
            queue.getActiveCount(),
            queue.getFailedCount(),
            queue.getDelayedCount(),
          ]);
          snapshot[name] = { waiting, active, failed, delayed };
        } catch (err) {
          this.logger.warn(`[incident] Could not snapshot queue ${name}: ${err}`);
          snapshot[name] = { waiting: -1, active: -1, failed: -1, delayed: -1 };
        }
      }),
    );

    return snapshot;
  }
}
