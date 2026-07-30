import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { OnboardingStep, STEP_COMPLETION_PERCENTAGE } from '../entities/onboarding-session.entity';

export class RegisterHospitalDto {
  @IsNotEmpty()
  @IsString()
  @MinLength(2)
  hospitalName: string;

  @IsEmail()
  adminEmail: string;

  @IsNotEmpty()
  @IsString()
  plan: string;

  @IsNotEmpty()
  @IsString()
  dataResidencyRegion: string;
}

export class VerifyEmailDto {
  @IsNotEmpty()
  @IsString()
  token: string;
}

export class ConfigureHospitalDto {
  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsString()
  locale?: string;

  @IsOptional()
  settings?: Record<string, any>;
}

export class OnboardingStatusResponseDto {
  sessionId: string;
  hospitalName: string;
  adminEmail: string;
  currentStep: OnboardingStep;
  completionPercentage: number;
  status: string;
  stellarPublicKey?: string;
  tenantId?: string;
  createdAt: Date;
  updatedAt: Date;

  static from(session: any): OnboardingStatusResponseDto {
    return {
      sessionId: session.id,
      hospitalName: session.hospitalName,
      adminEmail: session.adminEmail,
      currentStep: session.currentStep,
      completionPercentage: STEP_COMPLETION_PERCENTAGE[session.currentStep as OnboardingStep] ?? 0,
      status: session.status,
      stellarPublicKey: session.stellarPublicKey ?? undefined,
      tenantId: session.tenantId ?? undefined,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }
}
