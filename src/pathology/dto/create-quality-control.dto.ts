import { IsString, IsUUID, IsEnum, IsOptional, IsBoolean, IsDateString } from 'class-validator';
import { QCType, DiscrepancySeverity } from '../entities/quality-control.entity';

export class CreateQualityControlDto {
  @IsUUID()
  pathologyCaseId: string;

  @IsEnum(QCType)
  qcType: QCType;

  @IsUUID()
  reviewerId: string;

  @IsString()
  reviewerName: string;

  @IsDateString()
  @IsOptional()
  reviewDate?: string;

  @IsString()
  findings: string;

  @IsString()
  @IsOptional()
  discrepancies?: string;

  @IsEnum(DiscrepancySeverity)
  @IsOptional()
  severity?: DiscrepancySeverity;

  @IsString()
  @IsOptional()
  actionTaken?: string;

  @IsBoolean()
  @IsOptional()
  followUpRequired?: boolean;

  @IsBoolean()
  @IsOptional()
  educationalValue?: boolean;

  @IsString()
  @IsOptional()
  educationalNotes?: string;

  @IsBoolean()
  @IsOptional()
  agreement?: boolean;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsOptional()
  metadata?: Record<string, any>;
}
