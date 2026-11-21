import { IsEnum, IsString, IsOptional, IsBoolean, IsArray, IsUrl } from 'class-validator';
import { IncidentType } from '../../healthcare-monitoring/entities/healthcare-incident.entity';

export class CreateRunbookMappingDto {
  @IsEnum(IncidentType)
  incidentCategory: IncidentType;

  @IsString()
  runbookId: string;

  @IsString()
  runbookTitle: string;

  @IsUrl()
  runbookUrl: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  steps?: string[];
}

export class UpdateRunbookMappingDto {
  @IsOptional()
  @IsString()
  runbookId?: string;

  @IsOptional()
  @IsString()
  runbookTitle?: string;

  @IsOptional()
  @IsUrl()
  runbookUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  steps?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
