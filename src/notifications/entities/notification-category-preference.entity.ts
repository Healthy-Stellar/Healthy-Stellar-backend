import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum NotificationChannel {
  EMAIL = 'email',
  IN_APP = 'in_app',
  WEBSOCKET = 'websocket',
}

export enum NotificationFrequency {
  IMMEDIATE = 'immediate',
  DAILY_DIGEST = 'daily_digest',
}

/**
 * Per-user, per-category notification preference: which channels a category
 * is delivered on, whether it's enabled at all, and immediate vs. digest delivery.
 */
@Entity('notification_category_preferences')
@Index(['userId', 'category'], { unique: true })
export class NotificationCategoryPreference {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  category: string;

  @Column({ type: 'simple-array', default: `${NotificationChannel.EMAIL},${NotificationChannel.IN_APP}` })
  channels: NotificationChannel[];

  @Column({ default: true })
  enabled: boolean;

  @Column({ type: 'varchar', default: NotificationFrequency.IMMEDIATE })
  frequency: NotificationFrequency;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
