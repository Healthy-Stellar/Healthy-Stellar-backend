import {
  IsString,
  IsEnum,
  IsOptional,
  IsNumber,
  IsArray,
  IsDateString,
  MaxLength,
  IsBoolean,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DenialReason, AppealStatus } from '../../common/enums';

class DenialCodeDto {
  @ApiProperty()
  @IsString()
  code: string;

  @ApiProperty()
  @IsString()
  description: string;

  @ApiProperty()
  @IsString()
  category: string;
}

class RequiredActionDto {
  @ApiProperty()
  @IsString()
  action: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dueDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  completedAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateDenialDto {
  @ApiProperty()
  @IsString()
  @MaxLength(100)
  claimId: string;

  @ApiProperty()
  @IsDateString()
  denialDate: string;

  @ApiProperty({ enum: DenialReason })
  @IsEnum(DenialReason)
  primaryReason: DenialReason;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  additionalReasons?: string[];

  @ApiPropertyOptional({ type: [DenialCodeDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DenialCodeDto)
  denialCodes?: DenialCodeDto[];

  @ApiProperty()
  @IsNumber()
  deniedAmount: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  payerExplanation?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  internalNotes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isAppealable?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  appealDeadline?: string;

  @ApiPropertyOptional({ type: [RequiredActionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RequiredActionDto)
  requiredActions?: RequiredActionDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assignedTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  priority?: number;
}

export class UpdateDenialDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  payerExplanation?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  internalNotes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isAppealable?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  appealDeadline?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isResolved?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  resolutionType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  recoveredAmount?: number;

  @ApiPropertyOptional({ type: [RequiredActionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RequiredActionDto)
  requiredActions?: RequiredActionDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assignedTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  priority?: number;
}

class SupportingDocumentDto {
  @ApiProperty()
  @IsString()
  documentId: string;

  @ApiProperty()
  @IsString()
  documentType: string;

  @ApiProperty()
  @IsString()
  fileName: string;
}

class AdditionalCodeDto {
  @ApiProperty()
  @IsString()
  codeType: string;

  @ApiProperty()
  @IsString()
  code: string;

  @ApiProperty()
  @IsString()
  description: string;
}

export class CreateAppealDto {
  @ApiProperty()
  @IsString()
  @MaxLength(100)
  denialId: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsNumber()
  appealLevel?: number;

  @ApiProperty()
  @IsString()
  appealReason: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clinicalJustification?: string;

  @ApiPropertyOptional({ type: [SupportingDocumentDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SupportingDocumentDto)
  supportingDocuments?: SupportingDocumentDto[];

  @ApiPropertyOptional({ type: [AdditionalCodeDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdditionalCodeDto)
  additionalCodes?: AdditionalCodeDto[];

  @ApiProperty()
  @IsNumber()
  appealedAmount: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assignedTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  deadline?: string;
}

export class UpdateAppealDto {
  @ApiPropertyOptional({ enum: AppealStatus })
  @IsOptional()
  @IsEnum(AppealStatus)
  status?: AppealStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  submittedDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  decisionDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  payerResponse?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  payerReferenceNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  approvedAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  internalNotes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assignedTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isExternalReview?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  externalReviewOrganization?: string;
}

export class DenialSearchDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  claimId?: string;

  @ApiPropertyOptional({ enum: DenialReason })
  @IsOptional()
  @IsEnum(DenialReason)
  primaryReason?: DenialReason;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isResolved?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isAppealable?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assignedTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsNumber()
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @IsNumber()
  limit?: number;
}

export class AppealSearchDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  claimId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  denialId?: string;

  @ApiPropertyOptional({ enum: AppealStatus })
  @IsOptional()
  @IsEnum(AppealStatus)
  status?: AppealStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  appealLevel?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assignedTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsNumber()
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @IsNumber()
  limit?: number;
}
