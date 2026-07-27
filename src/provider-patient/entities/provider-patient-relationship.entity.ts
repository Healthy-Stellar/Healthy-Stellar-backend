import {
  Entity,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  PrimaryGeneratedColumn,
  Index,
  Unique,
} from 'typeorm';

@Entity('provider_patient_relationships')
@Unique(['providerId', 'patientId'])
@Index('IDX_PPR_PROVIDER', ['providerId'])
@Index('IDX_PPR_PATIENT', ['patientId'])
export class ProviderPatientRelationship {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  providerId: string;

  @Column()
  patientId: string;

  @CreateDateColumn()
  firstInteractionAt: Date;

  @Column({ type: 'int', default: 1 })
  recordCount: number;
}
