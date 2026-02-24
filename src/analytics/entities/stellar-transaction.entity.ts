import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('stellar_transactions')
@Index(['txHash'], { unique: true })
@Index(['createdAt'])
export class StellarTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 64 })
  txHash: string;

  @Column({ type: 'varchar', length: 50 })
  operationType: string;

  @Column({ type: 'uuid', nullable: true })
  relatedEntityId: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  relatedEntityType: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;
}
