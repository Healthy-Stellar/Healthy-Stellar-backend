import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('safety_alerts')
export class SafetyAlert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  prescriptionId: string;

  @Column({ type: 'enum', enum: ['drug-interaction', 'allergy', 'duplicate-therapy', 'high-dose', 'contraindication', 'age-related', 'pregnancy'] })
  alertType: string;

  @Column({ type: 'enum', enum: ['minor', 'moderate', 'major', 'critical'] })
  severity: string;

  @Column('text')
  message: string;

  @Column('text', { nullable: true })
  recommendation: string;

  @Column({ default: false })
  acknowledged: boolean;

  @Column({ nullable: true })
  acknowledgedBy: string;

  @Column({ type: 'timestamp', nullable: true })
  acknowledgedAt: Date;

  @Column('text', { nullable: true })
  pharmacistNotes: string;

  @CreateDateColumn()
  createdAt: Date;
}