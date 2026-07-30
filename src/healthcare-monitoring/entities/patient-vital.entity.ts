import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('patient_vitals')
@Index(['patientId', 'recordedAt'])
@Index(['tenantId', 'patientId', 'recordedAt'])
export class PatientVital {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  @Index()
  patientId: string;

  @Column({ type: 'uuid', nullable: true })
  tenantId: string;

  /** Beats per minute */
  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  heartRate: number;

  /** mmHg */
  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  systolicBp: number;

  /** mmHg */
  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  diastolicBp: number;

  /** Percentage (SpO2) */
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  oxygenSaturation: number;

  /** Celsius */
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  temperature: number;

  /** Breaths per minute */
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  respiratoryRate: number;

  /** mg/dL */
  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  bloodGlucose: number;

  @Column({ type: 'uuid', nullable: true })
  recordedBy: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn()
  recordedAt: Date;
}
