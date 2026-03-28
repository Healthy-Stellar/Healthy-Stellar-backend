import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('governance_snapshots')
@Index(['snapshotDate'])
export class GovernanceSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'date' })
  snapshotDate: Date;

  @Column({ type: 'int', default: 0 })
  dailyProposals: number;

  @Column({ type: 'int', default: 0 })
  dailyVotes: number;

  @Column({ type: 'int', default: 0 })
  dailyParticipation: number;

  @Column({ type: 'bigint', default: 0 })
  treasuryBalance: string;

  @Column({ type: 'int', default: 0 })
  totalProposals: number;

  @Column({ type: 'int', default: 0 })
  activeProposals: number;

  @Column({ type: 'int', default: 0 })
  uniqueVoters: number;

  @Column({ type: 'int', default: 0 })
  uniqueProposers: number;

  @Column({ type: 'int', default: 0 })
  healthScore: number;

  @CreateDateColumn()
  createdAt: Date;
}
