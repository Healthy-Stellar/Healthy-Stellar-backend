import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

@Entity('audit_logs')
@Index(['entityType', 'entityId'])
@Index(['userId'])
@Index(['operation'])
@Index(['timestamp'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn({
    type: 'timestamp with time zone',
    name: 'timestamp',
  })
  timestamp: Date;

  @Column({
    type: 'varchar',
    length: 100,
    name: 'operation',
  })
  operation: string;

  @Column({
    type: 'varchar',
    length: 100,
    name: 'entity_type',
  })
  entityType: string;

  @Column({
    type: 'uuid',
    name: 'entity_id',
    nullable: true,
  })
  entityId: string;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'user_id',
  })
  userId: string;

  @Column({
    type: 'inet',
    name: 'ip_address',
    nullable: true,
  })
  ipAddress: string;

  @Column({
    type: 'varchar',
    length: 500,
    name: 'user_agent',
    nullable: true,
  })
  userAgent: string;

  @Column({
    type: 'jsonb',
    name: 'changes',
    nullable: true,
  })
  changes: Record<string, any>;

  @Column({
    type: 'jsonb',
    name: 'old_values',
    nullable: true,
  })
  oldValues: Record<string, any>;

  @Column({
    type: 'jsonb',
    name: 'new_values',
    nullable: true,
  })
  newValues: Record<string, any>;

  @Column({
    type: 'varchar',
    length: 50,
    name: 'status',
    default: 'success',
  })
  status: string;

  @Column({
    type: 'text',
    name: 'error_message',
    nullable: true,
  })
  errorMessage: string;

  @Column({
    type: 'integer',
    name: 'execution_time_ms',
    nullable: true,
  })
  executionTimeMs: number;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'request_id',
    nullable: true,
  })
  requestId: string;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'session_id',
    nullable: true,
  })
  sessionId: string;
}
