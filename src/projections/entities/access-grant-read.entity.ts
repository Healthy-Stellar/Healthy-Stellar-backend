import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn, Index } from 'typeorm';

/** Denormalized read model for access grants queries. */
@Entity('access_grants_read')
@Index(['patientId', 'status'])
@Index(['grantedTo', 'status'])
export class AccessGrantReadModel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'aggregate_id', unique: true })
  aggregateId: string;

  @Column({ type: 'uuid' })
  patientId: string;

  @Column({ type: 'uuid' })
  grantedTo: string;

  @Column({ type: 'uuid' })
  grantedBy: string;

  @Column({ type: 'varchar', length: 50, default: 'ACTIVE' })
  status: string;

  @Column({ type: 'timestamp with time zone', nullable: true })
  expiresAt: Date;

  @Column({ type: 'uuid', nullable: true })
  revokedFrom: string;

  @Column({ type: 'uuid', nullable: true })
  revokedBy: string;

  @Column({ type: 'text', nullable: true })
  revocationReason: string;

  @Column({ type: 'integer', default: 0 })
  version: number;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;
}
