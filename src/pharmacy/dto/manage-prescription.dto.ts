import {
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class UpdatePrescriptionItemDto {
  @IsUUID()
  @IsOptional()
  id?: string;

  @IsUUID()
  @IsOptional()
  drugId?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  quantityPrescribed?: number;

  @IsString()
  @IsOptional()
  dosageInstructions?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  daySupply?: number;
}

export class UpdatePrescriptionDto {
  @IsString()
  @IsOptional()
  @MaxLength(500)
  notes?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  refillsAllowed?: number;

  @IsDateString()
  @IsOptional()
  prescriptionDate?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdatePrescriptionItemDto)
  @IsOptional()
  items?: UpdatePrescriptionItemDto[];
}

export class SearchPrescriptionsDto {
  @IsString()
  @IsOptional()
  @IsIn(['pending', 'verified', 'filling', 'filled', 'dispensed', 'cancelled'])
  status?: string;

  @IsString()
  @IsOptional()
  prescriberId?: string;

  @IsString()
  @IsOptional()
  patientId?: string;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;
}

export class AddPrescriptionNoteDto {
  @IsString()
  @MaxLength(2000)
  note: string;

  @IsString()
  @IsOptional()
  authorId?: string;
}
