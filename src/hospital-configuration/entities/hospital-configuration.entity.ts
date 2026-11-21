import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Persisted hospital configuration state.
 *
 * Replaces the process-local Maps/scalars previously held inside
 * HospitalConfigurationService so that configuration survives restarts and is
 * shared across horizontally-scaled instances.
 */
@Entity('hospital_configurations')
export class HospitalConfiguration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true, default: 'default' })
  hospitalId: string;

  @Column({ type: 'varchar', length: 64, default: 'UTC' })
  timezone: string;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  departments: any[];

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  equipment: any[];

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  resources: any[];

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  policies: any[];

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  procedures: any[];

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  alertConfigs: any[];

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  notificationSettings: Record<string, any>;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  insuranceProviders: any[];

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  billingConfig: Record<string, any>;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  emergencyProtocols: any[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
