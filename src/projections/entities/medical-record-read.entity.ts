import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn, Index } from 'typeorm';

/** Denormalized read model for medical records queries. */
@Entity('medical_records_read')
@Index(['patientId'])
@Index(['recordType'])
export class MedicalRecordReadModel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'aggregate_id', unique: true })
  aggregateId: string;

  @Column({ type: 'uuid' })
  patientId: string;

  @Column({ type: 'varchar', length: 100 })
  recordType: string;

  @Column({ type: 'varchar', nullable: true })
  cid: string;

  @Column({ type: 'varchar', nullable: true })
  uploadedBy: string;

  @Column({ type: 'varchar', nullable: true })
  amendedBy: string;

  @Column({ type: 'jsonb', nullable: true })
  lastChanges: Record<string, unknown>;

  @Column({ type: 'boolean', default: false })
  deleted: boolean;

  @Column({ type: 'integer', default: 0 })
  version: number;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;
}
