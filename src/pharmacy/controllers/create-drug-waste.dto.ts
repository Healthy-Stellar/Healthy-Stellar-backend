import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { DisposalMethod, WasteReason } from '../entities/drug-waste.entity';

export class CreateDrugWasteDto {
  @IsUUID()
  inventoryId: string;

  @IsEnum(WasteReason)
  reason: WasteReason;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsNumber()
  @Min(0)
  unitCost: number;

  @IsEnum(DisposalMethod)
  disposalMethod: DisposalMethod;

  @IsDateString()
  wasteDate: string;

  @IsString()
  witnessedBy: string;

  @IsString()
  @IsOptional()
  documentedBy?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsBoolean()
  @IsOptional()
  requiresDEAForm?: boolean;

  @IsString()
  @IsOptional()
  deaFormNumber?: string;

  @IsOptional()
  disposalDetails?: {
    facilityName?: string;
    facilityAddress?: string;
    manifestNumber?: string;
    disposalCertificate?: string;
  };
}
