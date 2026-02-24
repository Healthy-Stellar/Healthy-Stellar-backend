import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { FormularyStatus, FormularyTier } from '../entities/drug-formulary.entity';

export class CreateDrugFormularyDto {
  @IsUUID()
  drugId: string;

  @IsEnum(FormularyTier)
  @IsOptional()
  tier?: FormularyTier;

  @IsEnum(FormularyStatus)
  @IsOptional()
  status?: FormularyStatus;

  @IsNumber()
  @IsOptional()
  copayAmount?: number;

  @IsNumber()
  @IsOptional()
  coinsurancePercentage?: number;

  @IsNumber()
  @IsOptional()
  maxQuantityPerPrescription?: number;

  @IsNumber()
  @IsOptional()
  maxDaysSupply?: number;

  @IsNumber()
  @IsOptional()
  maxRefills?: number;

  @IsDateString()
  @IsOptional()
  effectiveDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsBoolean()
  @IsOptional()
  priorAuthorizationRequired?: boolean;

  @IsBoolean()
  @IsOptional()
  stepTherapyRequired?: boolean;

  @IsBoolean()
  @IsOptional()
  quantityLimitsApply?: boolean;

  @IsArray()
  @IsOptional()
  alternativeDrugs?: string[];

  @IsString()
  @IsOptional()
  notes?: string;

  @IsNumber()
  @IsOptional()
  estimatedAnnualCost?: number;
}
