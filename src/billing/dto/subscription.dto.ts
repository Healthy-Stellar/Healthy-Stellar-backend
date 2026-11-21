import { SubscriptionCadence, SubscriptionStatus } from '../../common/enums';
import { IsEnum, IsString, IsNumber, IsBoolean, IsOptional, IsArray, IsDateString, Min, Max } from 'class-validator';

export class CreateSubscriptionPlanDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(SubscriptionCadence)
  cadence: SubscriptionCadence;

  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsArray()
  includedServices?: Array<{
    serviceType: string;
    quantity?: number;
    description?: string;
  }>;

  @IsOptional()
  @IsNumber()
  @Min(0)
  trialPeriodDays?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  metadata?: Record<string, any>;
}

export class UpdateSubscriptionPlanDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(SubscriptionCadence)
  cadence?: SubscriptionCadence;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsArray()
  includedServices?: Array<{
    serviceType: string;
    quantity?: number;
    description?: string;
  }>;

  @IsOptional()
  @IsNumber()
  @Min(0)
  trialPeriodDays?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  metadata?: Record<string, any>;
}

export class CreatePatientSubscriptionDto {
  @IsString()
  patientId: string;

  @IsString()
  patientName: string;

  @IsString()
  planId: string;

  @IsDateString()
  startDate: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsBoolean()
  autoRenew?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  maxFailedPaymentsBeforeSuspension?: number;

  @IsOptional()
  metadata?: Record<string, any>;
}

export class UpdatePatientSubscriptionDto {
  @IsOptional()
  @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsBoolean()
  autoRenew?: boolean;

  @IsOptional()
  @IsDateString()
  cancelledAt?: string;

  @IsOptional()
  @IsString()
  cancellationReason?: string;

  @IsOptional()
  metadata?: Record<string, any>;
}

export class ChangeSubscriptionPlanDto {
  @IsString()
  newPlanId: string;

  @IsOptional()
  @IsDateString()
  effectiveDate?: string;

  @IsOptional()
  @IsBoolean()
  prorate?: boolean;
}

export class SubscriptionSearchDto {
  @IsOptional()
  @IsString()
  patientId?: string;

  @IsOptional()
  @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus;

  @IsOptional()
  @IsString()
  planId?: string;

  @IsOptional()
  @IsNumber()
  page?: number;

  @IsOptional()
  @IsNumber()
  limit?: number;
}
