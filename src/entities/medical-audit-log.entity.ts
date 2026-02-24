import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { AuditAction, MedicalDepartment } from '../roles/medical-roles.enum';

@Entity('medical_audit_logs')
export class MedicalAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  staffId: string;

  @Column({ type: 'enum', enum: AuditAction })
  action: AuditAction | string;

  @Column()
  resource: string;

  @Column({ nullable: true })
  resourceId?: string;

  @Column({ nullable: true })
  patientId?: string;

  @Column({ type: 'enum', enum: MedicalDepartment, nullable: true })
  department?: MedicalDepartment;

  @Column({ default: false })
  isEmergencyOverride: boolean;

  @Column({ nullable: true })
  ipAddress?: string;

  @Column({ nullable: true })
  userAgent?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @Column({ default: true })
  success: boolean;

  @Column({ nullable: true })
  failureReason?: string;

  @CreateDateColumn()
  timestamp: Date;
}
