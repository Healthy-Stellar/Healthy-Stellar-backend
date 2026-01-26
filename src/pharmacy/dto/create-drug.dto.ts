import { IsString, IsNotEmpty, IsEnum, IsBoolean, IsOptional, IsArray, Length } from 'class-validator';

export class CreateDrugDto {
  @IsString()
  @IsNotEmpty()
  @Length(10, 11)
  ndcCode: string;

  @IsString()
  @IsNotEmpty()
  brandName: string;

  @IsString()
  @IsNotEmpty()
  genericName: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsNotEmpty()
  manufacturer: string;

  @IsString()
  @IsNotEmpty()
  dosageForm: string;

  @IsString()
  @IsNotEmpty()
  strength: string;

  @IsString()
  @IsNotEmpty()
  route: string;

  @IsEnum(['I', 'II', 'III', 'IV', 'V', 'non-controlled'])
  controlledSubstanceSchedule: string;

  @IsArray()
  @IsOptional()
  therapeuticClasses?: string[];

  @IsArray()
  @IsOptional()
  indications?: string[];

  @IsArray()
  @IsOptional()
  contraindications?: string[];

  @IsString()
  @IsOptional()
  warnings?: string;

  @IsString()
  @IsOptional()
  sideEffects?: string;

  @IsBoolean()
  @IsOptional()
  requiresPrescription?: boolean;

  @IsBoolean()
  @IsOptional()
  isRefrigerated?: boolean;

  @IsBoolean()
  @IsOptional()
  isHazardous?: boolean;
}