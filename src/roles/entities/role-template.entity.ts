import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum RoleTemplateCategory {
  CLINICAL = 'CLINICAL',
  ADMINISTRATIVE = 'ADMINISTRATIVE',
  LABORATORY = 'LABORATORY',
  PHARMACY = 'PHARMACY',
  EMERGENCY = 'EMERGENCY',
}

@Entity('role_templates')
@Index(['category', 'version'])
@Index(['name', 'version'], { unique: true })
export class RoleTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  name: string;

  @Column({ length: 500, nullable: true })
  description: string;

  @Column({ type: 'enum', enum: RoleTemplateCategory, default: RoleTemplateCategory.CLINICAL })
  category: RoleTemplateCategory;

  @Column({ type: 'int', default: 1 })
  version: number;

  @Column({ type: 'simple-array' })
  permissions: string[];

  @Column({ type: 'simple-array', default: '' })
  departmentAccess: string[];

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
