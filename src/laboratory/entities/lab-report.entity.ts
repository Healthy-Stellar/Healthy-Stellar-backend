import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { LabReportTemplate } from './lab-report-template.entity';
import { LabOrder } from './lab-order.entity';

export enum ReportStatus {
  GENERATING = 'generating',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SENT = 'sent',
}

@Entity('lab_reports')
export class LabReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'template_id' })
  templateId: string;

  @ManyToOne(() => LabReportTemplate, (template) => template.reports)
  @JoinColumn({ name: 'template_id' })
  template: LabReportTemplate;

  @Column({ name: 'lab_order_id', nullable: true })
  labOrderId: string;

  @ManyToOne(() => LabOrder)
  @JoinColumn({ name: 'lab_order_id' })
  labOrder: LabOrder;

  @Column()
  title: string;

  @Column({ type: 'enum', enum: ReportStatus, default: ReportStatus.GENERATING })
  status: ReportStatus;

  @Column({ name: 'file_path', nullable: true })
  filePath: string;

  @Column({ name: 'file_size', nullable: true })
  fileSize: number;

  @Column({ name: 'generated_by' })
  generatedBy: string;

  @Column({ name: 'generated_at', nullable: true })
  generatedAt: Date;

  @Column({ name: 'sent_to', nullable: true })
  sentTo: string;

  @Column({ name: 'sent_at', nullable: true })
  sentAt: Date;

  @Column({ type: 'json', nullable: true })
  parameters: Record<string, any>;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
