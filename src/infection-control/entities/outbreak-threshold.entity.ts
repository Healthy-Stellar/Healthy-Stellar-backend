import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * Configurable per-pathogen, per-ward outbreak detection threshold.
 *
 * `location` is matched against `InfectionCase.location`, which is the only
 * ward/location identifier currently present on that entity (it has no FK
 * relationship to the Ward entity in department-and-ward-management).
 */
@Entity('outbreak_thresholds')
@Index(['pathogen', 'location'])
export class OutbreakThreshold {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  pathogen: string;

  @Column()
  location: string;

  @Column({ type: 'int' })
  thresholdCount: number;

  @Column({ type: 'int', default: 1440 })
  windowMinutes: number;

  @Column({ default: true })
  isActive: boolean;

  /**
   * Pragmatic recipient configuration: there is no infection-control-officer
   * role or role-based notification lookup elsewhere in the codebase, so
   * recipients are configured directly on the threshold.
   */
  @Column({ type: 'simple-array', nullable: true })
  notifyEmails: string[] | null;

  @Column({ type: 'simple-array', nullable: true })
  notifyUserIds: string[] | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
