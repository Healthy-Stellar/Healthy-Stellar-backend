import { IsString, IsNotEmpty, IsDateString, IsArray, ValidateNested, IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

class PrescriptionItemDto {
  @IsString()
  @IsNotEmpty()
  drugId: string;

  @IsInt()
  @Min(1)
  quantityPrescribed: number;

  @IsString()
  @IsNotEmpty()
  dosageInstructions: string;

  @IsInt()
  @IsOptional()
  daySupply?: number;
}

export class CreatePrescriptionDto {
  @IsString()
  @IsNotEmpty()
  prescriptionNumber: string;

  @IsString()
  @IsNotEmpty()
  patientId: string;

  @IsString()
  @IsNotEmpty()
  patientName: string;

  @IsDateString()
  patientDOB: string;

  @IsArray()
  @IsOptional()
  patientAllergies?: string[];

  @IsString()
  @IsNotEmpty()
  prescriberId: string;

  @IsString()
  @IsNotEmpty()
  prescriberName: string;

  @IsString()
  @IsNotEmpty()
  prescriberLicense: string;

  @IsString()
  @IsNotEmpty()
  prescriberDEA: string;

  @IsDateString()
  prescriptionDate: string;

  @IsInt()
  @Min(0)
  refillsAllowed: number;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PrescriptionItemDto)
  items: PrescriptionItemDto[];
}