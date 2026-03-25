import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('patients')
export class Patient {
  /**
   * -----------------------------
   * Core Identifiers
   * -----------------------------
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  mrn: string;

  /**
   * -----------------------------
   * Personal Demographics
   * -----------------------------
   */
  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ nullable: true })
  middleName?: string;

  @Column({ type: 'date' })
  dateOfBirth: string;

  @Column()
  sex: 'male' | 'female' | 'other' | 'unknown';

  @Column({ nullable: true })
  genderIdentity?: string;

  /**
   * -----------------------------
   * Medical Demographics
   * -----------------------------
   */
  @Column({ nullable: true })
  bloodGroup?: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';

  @Column('json', { nullable: true })
  knownAllergies?: string[];

  @Column({ nullable: true })
  primaryLanguage?: string;

  @Column({ nullable: true })
  nationality?: string;

  @Column({ nullable: true })
  ethnicity?: string;

  @Column({ nullable: true })
  maritalStatus?: 'single' | 'married' | 'divorced' | 'widowed' | 'other';

  /**
   * -----------------------------
   * Contact Information
   * -----------------------------
   */
  @Column({ nullable: true })
  phone?: string;

  @Column({ nullable: true })
  email?: string;

  @Column('json', { nullable: true })
  address?: string;

  /**
   * -----------------------------
   * Identification & Media
   * -----------------------------
   */
  @Column({ nullable: true })
  patientPhotoUrl?: string; // clinical identification photo

  @Column({ nullable: true, unique: true })
  nationalId?: string;

  @Column({ nullable: true })
  nationalIdType?: string; // e.g., Passport, SSN, NIN

  /**
   * -----------------------------
   * Stellar / Blockchain Identity
   * -----------------------------
   */
  @Index()
  @Column({ nullable: true, unique: true })
  stellarAddress?: string; // immutable once set

  @Column({ nullable: true })
  nationalIdHash?: string; // SHA-256 hash of national ID — immutable once set

  /**
   * -----------------------------
   * Off-chain Profile Metadata
   * -----------------------------
   */
  @Column('json', { nullable: true })
  contactPreferences?: Record<string, any>; // e.g. { preferredChannel: 'email', language: 'en' }

  @Column('json', { nullable: true })
  emergencyContact?: Record<string, any>; // e.g. { name, phone, relationship }

  /**
   * -----------------------------
   * Administrative / Workflow
   * -----------------------------
   */
  @Column({ default: false })
  isAdmitted: boolean;

  @Column({ nullable: true, type: 'date' })
  admissionDate?: string;

  @Column({ nullable: true, type: 'date' })
  dischargeDate?: string;

  @Column({ default: true })
  isActive: boolean; // archived vs active

  /**
   * -----------------------------
   * Geo-Restriction
   * -----------------------------
   * ISO 3166-1 alpha-2 country codes that are allowed to access this patient's records.
   * Empty array = no restriction.
   */
  @Column('simple-array', { nullable: true, default: null })
  allowedCountries: string[] | null;

  /**
   * -----------------------------
   * System Metadata
   * -----------------------------
   */
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

export default Patient;
