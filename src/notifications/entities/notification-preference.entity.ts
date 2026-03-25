import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('notification_preferences')
export class NotificationPreference {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column()
  patientId: string;

  @Column({ default: true })
  webSocketEnabled: boolean;

  @Column({ default: false })
  emailEnabled: boolean;

  @Column({ default: true })
  newRecordNotifications: boolean;

  @Column({ default: true })
  accessGrantedNotifications: boolean;

  @Column({ default: true })
  accessRevokedNotifications: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
