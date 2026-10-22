import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum TenantFieldRuleType {
  REGEX = 'REGEX',
  NUMBER = 'NUMBER',
  STRING = 'STRING',
}

@Entity('tenant_field_validation_rules')
@Index(['tenantId', 'fieldName'], { unique: true })
export class TenantFieldValidationRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar' })
  tenantId: string;

  /** Name of the field this rule applies to within a DTO's customFields bag. */
  @Column({ type: 'varchar' })
  fieldName: string;

  @Column({ type: 'enum', enum: TenantFieldRuleType, default: TenantFieldRuleType.STRING })
  type: TenantFieldRuleType;

  /** Regex source (no delimiters) used when type is REGEX. */
  @Column({ type: 'varchar', nullable: true })
  pattern: string | null;

  @Column({ type: 'boolean', default: false })
  required: boolean;

  @Column({ type: 'varchar', nullable: true })
  errorMessage: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
