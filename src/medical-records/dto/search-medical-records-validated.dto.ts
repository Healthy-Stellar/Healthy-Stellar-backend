import {
  IsString,
  IsUUID,
  IsOptional,
  IsEnum,
  IsDateString,
  MaxLength,
  MinLength,
} from 'class-validator';

enum SearchType {
  DIAGNOSIS = 'DIAGNOSIS',
  PROCEDURE = 'PROCEDURE',
  MEDICATION = 'MEDICATION',
  PROVIDER = 'PROVIDER',
  DATE_RANGE = 'DATE_RANGE',
}

export class SearchMedicalRecordsValidatedDto {
  @IsUUID()
  @IsOptional()
  patientId?: string;

  @IsEnum(SearchType)
  @IsOptional()
  searchType?: SearchType;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @IsOptional()
  query?: string;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsOptional()
  limit?: number = 50;

  @IsOptional()
  offset?: number = 0;
}
