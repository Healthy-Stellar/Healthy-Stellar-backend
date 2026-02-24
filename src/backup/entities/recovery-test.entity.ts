import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BackupLog } from './backup-log.entity';

export enum RecoveryTestStatus {
  SCHEDULED = 'scheduled',
  IN_PROGRESS = 'in_progress',
  PASSED = 'passed',
  FAILED = 'failed',
}

@Entity('recovery_tests')
export class RecoveryTest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => BackupLog)
  @JoinColumn({ name: 'backup_id' })
  backup: BackupLog;

  @Column()
  backupId: string;

  @Column({ type: 'enum', enum: RecoveryTestStatus })
  status: RecoveryTestStatus;

  @Column()
  testType: string;

  @Column({ type: 'jsonb' })
  testResults: Record<string, any>;

  @Column({ nullable: true })
  errorMessage: string;

  @CreateDateColumn()
  startedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date;

  @Column({ type: 'int', nullable: true })
  durationSeconds: number;

  @Column()
  testedBy: string;

  @Column({ type: 'text', nullable: true })
  notes: string;
}
