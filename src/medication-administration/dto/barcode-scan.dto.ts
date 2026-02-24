import { IsUUID, IsString, IsEnum, IsOptional, IsBoolean } from 'class-validator';
import { VerificationType } from '../entities/barcode-verification.entity';

export class BarcodeScanDto {
  @IsUUID()
  marId: string;

  @IsEnum(VerificationType)
  verificationType: VerificationType;

  @IsString()
  scannedBarcode: string;

  @IsOptional()
  @IsString()
  expectedBarcode?: string;

  @IsUUID()
  nurseId: string;

  @IsString()
  nurseName: string;

  @IsOptional()
  @IsString()
  deviceId?: string;

  @IsOptional()
  @IsString()
  overrideReason?: string;

  @IsOptional()
  @IsUUID()
  overrideAuthorizedBy?: string;

  @IsOptional()
  @IsString()
  verificationNotes?: string;
}
