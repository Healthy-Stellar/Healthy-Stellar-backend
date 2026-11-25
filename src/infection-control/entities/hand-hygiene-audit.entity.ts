import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
  UpdateDateColumn,
} from 'typeorm';

@Entity('hand_hygiene_audits')
export class HandHygieneAudit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  staffId: string;

  @Column()
  location: string;

  @Column()
  compliant: boolean;

  @Column({ type: 'date' })
  auditDate: Date;

  @Column({ type: 'text', nullable: true })
  observations: string;

  @Column({ type: 'varchar', nullable: true })
  @Index()
  tenantId: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
