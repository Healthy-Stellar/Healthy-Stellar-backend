import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum IncidentSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum IncidentStatus {
  OPEN = 'open',
  INVESTIGATING = 'investigating',
  RESOLVED = 'resolved',
}

/**
 * Persisted evidence bundle for a severe incident.
 * Captures a point-in-time snapshot of system state so on-call engineers
 * have structured, reproducible evidence without needing to reconstruct it
 * from scattered logs after the fact.
 */
@Entity('incident_evidence')
@Index(['severity', 'status'])
@Index(['capturedAt'])
export class IncidentEvidenceEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Human-readable title, e.g. "High memory on worker-2" */
  @Column({ type: 'varchar', length: 255 })
  title: string;

  /** Free-text description of what triggered the capture */
  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'enum', enum: IncidentSeverity, default: IncidentSeverity.HIGH })
  severity: IncidentSeverity;

  @Column({ type: 'enum', enum: IncidentStatus, default: IncidentStatus.OPEN })
  status: IncidentStatus;

  /** Who or what triggered the capture (operator ID, automated rule name, etc.) */
  @Column({ type: 'varchar', length: 255, nullable: true })
  triggeredBy: string;

  /** Active OTel trace ID at capture time, for correlation with Jaeger/Tempo */
  @Column({ type: 'varchar', length: 64, nullable: true })
  traceId: string;

  /** Node.js process memory snapshot */
  @Column({ type: 'jsonb', nullable: true })
  memorySnapshot: {
    rss: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
    arrayBuffers: number;
  };

  /** process.cpuUsage() delta since process start */
  @Column({ type: 'jsonb', nullable: true })
  cpuSnapshot: {
    user: number;
    system: number;
  };

  /** BullMQ queue depths at capture time */
  @Column({ type: 'jsonb', nullable: true })
  queueSnapshot: Record<string, { waiting: number; active: number; failed: number; delayed: number }>;

  /** Recent structured log lines (last N entries from in-memory ring buffer) */
  @Column({ type: 'jsonb', nullable: true })
  recentLogs: Array<{ level: string; message: string; timestamp: string; context?: string }>;

  /** Active OTel span context for correlation */
  @Column({ type: 'jsonb', nullable: true })
  traceContext: { traceId?: string; spanId?: string; traceFlags?: number };

  /** Arbitrary key/value metadata (e.g. triggering job ID, patient ID, queue name) */
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  /** Operator notes added during investigation */
  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn()
  capturedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  resolvedAt: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  resolvedBy: string;
}
