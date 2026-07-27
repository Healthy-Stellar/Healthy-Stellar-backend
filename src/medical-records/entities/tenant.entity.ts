import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Tenant – organisation-level record.
 *
 * KEK fields:
 *  • kek_arn      – KMS CMK ARN for this tenant (e.g. alias/hs-tenant-<id>)
 *  • kek_version  – Monotonically incrementing label written by the rotation
 *                   job so we can tell at a glance whether all attachment rows
 *                   have been re-wrapped.  Format: "v<epoch_ms>" e.g. "v1717000000000"
 *  • kek_rotated_at – Timestamp of the most recent successful rotation
 */
@Entity('tenants')
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ name: 'kek_arn', type: 'text', nullable: true })
  kekArn: string | null;

  /**
   * Current KEK version label.  All new uploads copy this value into
   * `medical_attachments.kek_version`.  After rotation completes, any
   * attachment row with an older kek_version label has been re-wrapped.
   */
  @Column({
    name: 'kek_version',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  kekVersion: string | null;

  @Column({ name: 'kek_rotated_at', type: 'timestamptz', nullable: true })
  kekRotatedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}