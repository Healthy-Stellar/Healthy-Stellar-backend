import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum MigrationStatus {
  PENDING = 'pending',
  EXECUTED = 'executed',
  FAILED = 'failed',
  REVERTED = 'reverted',
}

@Entity('migration_history')
@Index(['migrationName', 'status'])
export class MigrationHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'migration_name', type: 'varchar', length: 512 })
  @Index({ unique: false })
  migrationName: string;

  @CreateDateColumn({ name: 'executed_at', type: 'timestamptz' })
  executedAt: Date;

  @Column({ name: 'executed_by', type: 'varchar', length: 256, nullable: true })
  executedBy: string | null;

  @Column({ name: 'duration_ms', type: 'integer', nullable: true })
  durationMs: number | null;

  @Column({
    name: 'status',
    type: 'enum',
    enum: MigrationStatus,
    default: MigrationStatus.PENDING,
  })
  status: MigrationStatus;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ name: 'checksum', type: 'varchar', length: 64, nullable: true })
  checksum: string | null;

  @Column({
    name: 'dry_run',
    type: 'boolean',
    default: false,
  })
  dryRun: boolean;

  @Column({ name: 'reverted_at', type: 'timestamptz', nullable: true })
  revertedAt: Date | null;

  @Column({ name: 'reverted_by', type: 'varchar', length: 256, nullable: true })
  revertedBy: string | null;
}
