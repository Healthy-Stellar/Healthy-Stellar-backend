import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * A patient's consent for a category of PHI use.
 *
 * Consents accumulate rather than being overwritten: a later record for the
 * same patient and type supersedes an earlier one, and the earlier row stays
 * for the audit trail. `expirationDate` is nullable and null means no expiry.
 */
@Entity('patient_consents')
@Index(['patientId', 'consentType', 'consentDate'])
export class PatientConsentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  @Index()
  patientId: string;

  @Column({ type: 'varchar', length: 100 })
  consentType: string;

  @Column({ type: 'boolean' })
  consentGiven: boolean;

  @Column({ type: 'timestamp' })
  consentDate: Date;

  @Column({ type: 'timestamp', nullable: true })
  expirationDate: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
