import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { LabReport } from './lab-report.entity';

export enum ReportType {
  INDIVIDUAL_RESULT = 'individual_result',
  CUMULATIVE_REPORT = 'cumulative_report',
  CRITICAL_VALUES = 'critical_values',
  QUALITY_CONTROL = 'quality_control',
  WORKLOAD_SUMMARY = 'workload_summary',
  TURNAROUND_TIME = 'turnaround_time',
}

export enum ReportFormat {
  PDF = 'pdf',
  HTML = 'html',
  XML = 'xml',
  HL7 = 'hl7',
  CSV = 'csv',
}

@Entity('lab_report_templates')
export class LabReportTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'enum', enum: ReportType })
  type: ReportType;

  @Column({ type: 'enum', enum: ReportFormat, default: ReportFormat.PDF })
  format: ReportFormat;

  @Column({ type: 'text' })
  template: string; // HTML/XML template content

  @Column({ type: 'json', nullable: true })
  styles: Record<string, any>; // CSS styles for PDF/HTML

  @Column({ type: 'json', nullable: true })
  parameters: Record<string, any>; // Template parameters

  @Column({ name: 'header_template', type: 'text', nullable: true })
  headerTemplate: string;

  @Column({ name: 'footer_template', type: 'text', nullable: true })
  footerTemplate: string;

  @Column({ name: 'is_default', default: false })
  isDefault: boolean;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @OneToMany(() => LabReport, (report) => report.template)
  reports: LabReport[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
