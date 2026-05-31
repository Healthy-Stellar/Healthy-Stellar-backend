import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { WebhookSubscription } from './webhook-subscription.entity';

export enum WebhookDeliveryStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  DEADLETTER = 'deadletter',
}

/**
 * Tracks individual webhook delivery attempts for audit and replay.
 * Each event delivery to a subscriber creates one record.
 */
@Entity('webhook_deliveries')
export class WebhookDelivery {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Reference to the subscription */
  @Index()
  @Column({ type: 'uuid' })
  subscriptionId: string;

  @ManyToOne(() => WebhookSubscription, { onDelete: 'CASCADE', eager: true })
  @JoinColumn({ name: 'subscriptionId' })
  subscription: WebhookSubscription;

  /** The event type being delivered */
  @Index()
  @Column({ type: 'varchar', length: 128 })
  eventType: string;

  /** Tenant/organization ID for multi-tenancy */
  @Index()
  @Column({ type: 'uuid', nullable: true })
  tenantId: string | null;

  /** The event payload being delivered */
  @Column({ type: 'jsonb' })
  eventPayload: Record<string, any>;

  /** Current delivery status */
  @Index()
  @Column({
    type: 'enum',
    enum: WebhookDeliveryStatus,
    default: WebhookDeliveryStatus.PENDING,
  })
  status: WebhookDeliveryStatus;

  /** Number of delivery attempts made */
  @Column({ type: 'integer', default: 0 })
  attemptCount: number;

  /** Maximum attempts before moving to DLQ */
  @Column({ type: 'integer', default: 5 })
  maxAttempts: number;

  /** Last attempt's HTTP status code */
  @Column({ type: 'integer', nullable: true })
  lastHttpStatus: number | null;

  /** Last attempt's error message */
  @Column({ type: 'text', nullable: true })
  lastError: string | null;

  /** Response body from last attempt (first 4KB) */
  @Column({ type: 'text', nullable: true })
  lastResponseBody: string | null;

  /** Scheduled retry time */
  @Column({ type: 'timestamp', nullable: true })
  nextRetryAt: Date | null;

  /** All attempts history */
  @Column({ type: 'jsonb', default: '[]' })
  attempts: Array<{
    attemptNumber: number;
    timestamp: string;
    httpStatus: number | null;
    error: string | null;
    durationMs: number;
  }>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  /** When successfully delivered */
  @Column({ type: 'timestamp', nullable: true })
  deliveredAt: Date | null;

  /** When moved to DLQ */
  @Column({ type: 'timestamp', nullable: true })
  dlqMovedAt: Date | null;
}
