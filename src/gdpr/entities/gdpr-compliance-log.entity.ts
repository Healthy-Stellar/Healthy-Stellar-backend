import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('gdpr_compliance_logs')
@Index(['requestId', 'createdAt'])
export class GdprComplianceLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  requestId: string;

  @Column({ type: 'uuid', nullable: true })
  patientId: string;

  @Column({ nullable: true })
  tenantId: string;

  @Column({ nullable: true })
  operator: string;

  @Column({ nullable: true })
  scope: string;

  @Column({ type: 'jsonb', nullable: true })
  details: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;
}
