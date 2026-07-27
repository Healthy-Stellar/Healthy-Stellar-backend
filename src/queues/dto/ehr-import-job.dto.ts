import { IsString, IsNotEmpty, IsBoolean, IsOptional } from 'class-validator';
import { ImportFormat } from '../../ehr-import/entities/import-job.entity';
import { CsvColumnMap } from '../../ehr-import/parsers/csv.parser';

export class EhrImportJobDto {
  @IsString()
  @IsNotEmpty()
  jobId: string;

  @IsString()
  @IsNotEmpty()
  tempFilePath: string;

  @IsString()
  @IsNotEmpty()
  originalName: string;

  @IsString()
  @IsNotEmpty()
  format: ImportFormat;

  @IsBoolean()
  dryRun: boolean;

  @IsBoolean()
  @IsOptional()
  quarantineMode?: boolean;

  @IsOptional()
  columnMap?: CsvColumnMap;
}