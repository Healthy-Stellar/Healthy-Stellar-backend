import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum TemplateStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ARCHIVED = 'archived',
}

@Entity('report_templates')
@Index(['name'])
@Index(['organType'])
export class ReportTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 200 })
  @Index()
  name: string;

  @Column({ type: 'varchar', length: 100 })
  @Index()
  organType: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  procedureType: string;

  @Column({ type: 'varchar', length: 20 })
  version: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  capProtocolReference: string;

  @Column({
    type: 'enum',
    enum: TemplateStatus,
    default: TemplateStatus.DRAFT,
  })
  status: TemplateStatus;

  @Column({ type: 'jsonb' })
  sections: {
    clinicalInfo: {
      required: boolean;
      fields: string[];
    };
    gross: {
      required: boolean;
      fields: string[];
    };
    microscopic: {
      required: boolean;
      fields: string[];
    };
    diagnosis: {
      required: boolean;
      fields: string[];
    };
  };

  @Column({ type: 'jsonb', nullable: true })
  requiredFields: string[];

  @Column({ type: 'jsonb', nullable: true })
  optionalFields: string[];

  @Column({ type: 'jsonb', nullable: true })
  synopticElements: Array<{
    name: string;
    type: string;
    options?: string[];
    required: boolean;
  }>;

  @Column({ type: 'jsonb', nullable: true })
  stagingInfo: {
    system: string;
    fields: string[];
  };

  @Column({ type: 'jsonb', nullable: true })
  checklistItems: string[];

  @Column({ type: 'text', nullable: true })
  instructions: string;

  @Column({ type: 'uuid', nullable: true })
  approvedBy: string;

  @Column({ type: 'timestamp', nullable: true })
  approvedDate: Date;

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
