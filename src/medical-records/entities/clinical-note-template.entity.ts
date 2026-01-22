import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum TemplateCategory {
  CONSULTATION = 'consultation',
  PROCEDURE = 'procedure',
  DIAGNOSIS = 'diagnosis',
  TREATMENT = 'treatment',
  FOLLOW_UP = 'follow_up',
  GENERAL = 'general',
}

@Entity('clinical_note_templates')
@Index(['category', 'isActive'])
export class ClinicalNoteTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: TemplateCategory,
    default: TemplateCategory.GENERAL,
  })
  category: TemplateCategory;

  @Column({ type: 'text' })
  templateContent: string;

  @Column({ type: 'jsonb', nullable: true })
  structuredFields: Record<string, any>;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'boolean', default: false })
  isSystemTemplate: boolean;

  @Column({ type: 'uuid', nullable: true })
  createdBy: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
