import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum EmergencyResourceStatus {
  AVAILABLE = 'available',
  LIMITED = 'limited',
  UNAVAILABLE = 'unavailable',
}

@Entity('emergency_resources')
@Index(['resourceType', 'status'])
export class EmergencyResource {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  resourceType: string;

  @Column({ type: 'varchar', length: 150 })
  resourceName: string;

  @Column({ type: 'int', default: 0 })
  totalUnits: number;

  @Column({ type: 'int', default: 0 })
  availableUnits: number;

  @Column({
    type: 'enum',
    enum: EmergencyResourceStatus,
    default: EmergencyResourceStatus.AVAILABLE,
  })
  status: EmergencyResourceStatus;

  @Column({ type: 'varchar', length: 150, nullable: true })
  location: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
