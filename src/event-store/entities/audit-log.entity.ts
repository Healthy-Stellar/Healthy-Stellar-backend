import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  action: string; // e.g., 'CREATE', 'UPDATE', 'REVERT'

  @Column()
  entityName: string; // 'TreatmentPlan'

  @Column()
  entityId: string; // The ID of the target treatment plan

  @Column()
  userId: string; // The clinician/author ID

  @Column('jsonb', { nullable: true })
  metadata: any; // Additional context (e.g., version numbers involved)

  @CreateDateColumn()
  createdAt: Date;
}