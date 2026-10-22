import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum OnboardingStep {
  REGISTRATION = 'REGISTRATION',
  VERIFICATION = 'VERIFICATION',
  CONFIGURATION = 'CONFIGURATION',
  ACTIVATION = 'ACTIVATION',
  COMPLETED = 'COMPLETED',
}

export enum OnboardingSessionStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export const STEP_COMPLETION_PERCENTAGE: Record<OnboardingStep, number> = {
  [OnboardingStep.REGISTRATION]: 25,
  [OnboardingStep.VERIFICATION]: 50,
  [OnboardingStep.CONFIGURATION]: 75,
  [OnboardingStep.ACTIVATION]: 90,
  [OnboardingStep.COMPLETED]: 100,
};

@Entity('onboarding_sessions', { schema: 'public' })
export class OnboardingSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  hospitalName: string;

  @Column({ unique: true, length: 255 })
  adminEmail: string;

  @Column({ length: 50 })
  plan: string;

  @Column({ length: 100 })
  dataResidencyRegion: string;

  @Column({ type: 'enum', enum: OnboardingStep, default: OnboardingStep.REGISTRATION })
  currentStep: OnboardingStep;

  @Column({ type: 'enum', enum: OnboardingSessionStatus, default: OnboardingSessionStatus.ACTIVE })
  status: OnboardingSessionStatus;

  @Column({ length: 64 })
  verificationToken: string;

  @Column({ nullable: true, type: 'timestamp' })
  verifiedAt: Date;

  @Column({ nullable: true, length: 56 })
  stellarPublicKey: string;

  /** Secret key stored as opaque string — must be treated as credential */
  @Column({ nullable: true, type: 'text' })
  stellarSecretKey: string;

  @Column({ nullable: true })
  tenantId: string;

  @Column({ nullable: true, type: 'text' })
  provisioningError: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
