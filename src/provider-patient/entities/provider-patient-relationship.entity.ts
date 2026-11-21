import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum ProviderPatientRelationshipStatus {
  ACTIVE = 'active',
  TERMINATED = 'terminated',
}

@Entity('provider_patient_relationships')
export class ProviderPatientRelationship {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  providerAddress: string;

  @Column()
  patientAddress: string;

  @Column({ default: 1 })
  recordCount: number;

  @Column({
    type: 'enum',
    enum: ProviderPatientRelationshipStatus,
    default: ProviderPatientRelationshipStatus.ACTIVE,
  })
  status: ProviderPatientRelationshipStatus;

  @Column({ type: 'timestamp', nullable: true })
  terminatedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
