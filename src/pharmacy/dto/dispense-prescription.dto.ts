import { IsString, IsNotEmpty, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class DispenseItemDto {
  @IsString()
  @IsNotEmpty()
  prescriptionItemId: string;

  @IsString()
  @IsNotEmpty()
  inventoryId: string;

  @IsString()
  @IsNotEmpty()
  lotNumber: string;

  @IsString()
  @IsNotEmpty()
  expirationDate: string;
}

export class DispensePrescriptionDto {
  @IsString()
  @IsNotEmpty()
  pharmacistId: string;

  @IsString()
  @IsNotEmpty()
  pharmacistName: string;

  @IsString()
  @IsNotEmpty()
  pharmacistLicense: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DispenseItemDto)
  items: DispenseItemDto[];

  @IsString()
  @IsOptional()
  dispensingNotes?: string;

  @IsString()
  @IsOptional()
  patientCounselingNotes?: string;

  @IsString()
  @IsOptional()
  patientSignature?: string; // Base64 encoded signature
}
