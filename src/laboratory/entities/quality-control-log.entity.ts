import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum QCType {
  CALIBRATION = 'calibration',
  CONTROL_TEST = 'control_test',
  MAINTENANCE = 'maintenance',
  PROFICIENCY_TEST = 'proficiency_test',
}

export enum QCResult {
  PASS = 'pass',
  FAIL = 'fail',
  OUT_OF_RANGE = 'out_of_range',
  ACCEPTABLE = 'acceptable',
}

@Entity('quality_control_logs')
@Index(['equipmentId', 'qcDate'])
@Index(['labTestId'])
@Index(['qcType', 'qcResult'])
export class QualityControlLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: QCType,
  })
  qcType: QCType;

  @Column({ type: 'varchar', length: 100 })
  equipmentId: string;

  @Column({ type: 'varchar', length: 200 })
  equipmentName: string;

  @Column({ type: 'uuid', nullable: true })
  labTestId: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  labTestName: string;

  @Column({ type: 'timestamp' })
  qcDate: Date;

  @Column({ type: 'uuid' })
  performedBy: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  performedByName: string;

  @Column({
    type: 'enum',
    enum: QCResult,
  })
  qcResult: QCResult;

  @Column({
    type: 'jsonb',
    nullable: true,
    comment: 'Control levels and measured values',
  })
  qcValues: Array<{
    controlLevel: string;
    expectedValue?: number;
    measuredValue?: number;
    unit?: string;
    acceptableRange?: string;
    isWithinRange?: boolean;
  }>;

  @Column({ type: 'varchar', length: 100, nullable: true })
  lotNumber: string;

  @Column({ type: 'date', nullable: true })
  expirationDate: Date;

  @Column({ type: 'text', nullable: true })
  correctiveActions: string;

  @Column({ type: 'timestamp', nullable: true })
  nextDueDate: Date;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ type: 'uuid', nullable: true })
  createdBy: string;

  @Column({ type: 'uuid', nullable: true })
  updatedBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
