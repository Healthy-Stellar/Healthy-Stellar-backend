import { IsString, IsEnum, IsOptional, IsArray, IsObject } from 'class-validator';
import { TemplateStatus } from '../entities/report-template.entity';

export class CreateReportTemplateDto {
  @IsString()
  name: string;

  @IsString()
  organType: string;

  @IsString()
  @IsOptional()
  procedureType?: string;

  @IsString()
  version: string;

  @IsString()
  @IsOptional()
  capProtocolReference?: string;

  @IsEnum(TemplateStatus)
  @IsOptional()
  status?: TemplateStatus;

  @IsObject()
  sections: {
    clinicalInfo: {
      required: boolean;
      fields: string[];
    };
    gross: {
      required: boolean;
      fields: string[];
    };
    microscopic: {
      required: boolean;
      fields: string[];
    };
    diagnosis: {
      required: boolean;
      fields: string[];
    };
  };

  @IsArray()
  @IsOptional()
  requiredFields?: string[];

  @IsArray()
  @IsOptional()
  optionalFields?: string[];

  @IsArray()
  @IsOptional()
  synopticElements?: Array<{
    name: string;
    type: string;
    options?: string[];
    required: boolean;
  }>;

  @IsObject()
  @IsOptional()
  stagingInfo?: {
    system: string;
    fields: string[];
  };

  @IsArray()
  @IsOptional()
  checklistItems?: string[];

  @IsString()
  @IsOptional()
  instructions?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsOptional()
  metadata?: Record<string, any>;
}
