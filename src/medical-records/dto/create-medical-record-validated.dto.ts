import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsEnum,
  IsArray,
  ValidateNested,
  IsOptional,
  MaxLength,
  MinLength,
  Matches,
  Type,
} from 'class-validator';
import {
  IsValidICD10,
  IsValidCPT,
  IsValidMRN,
} from '../../common/validation/medical-validation.decorators';

enum RecordType {
  DIAGNOSIS = 'DIAGNOSIS',
  TREATMENT = 'TREATMENT',
  PRESCRIPTION = 'PRESCRIPTION',
  LAB_RESULT = 'LAB_RESULT',
  IMAGING = 'IMAGING',
}

export class DiagnosisCodeDto {
  @IsValidICD10({ message: 'Invalid ICD-10 diagnosis code' })
  @IsNotEmpty()
  code: string;

  @IsString()
  @MaxLength(500)
  @IsOptional()
  description: string;

  @IsString()
  @IsOptional()
  severity: string;
}

export class ProcedureCodeDto {
  @IsValidCPT({ message: 'Invalid CPT procedure code' })
  @IsNotEmpty()
  code: string;

  @IsString()
  @MaxLength(500)
  @IsOptional()
  description: string;

  @IsString()
  @IsOptional()
  date: string;
}

export class CreateMedicalRecordValidatedDto {
  @IsUUID()
  @IsNotEmpty()
  patientId: string;

  @IsEnum(RecordType)
  @IsNotEmpty()
  recordType: RecordType;

  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(5000)
  content: string;

  @ValidateNested({ each: true })
  @Type(() => DiagnosisCodeDto)
  @IsArray()
  @IsOptional()
  diagnosisCodes: DiagnosisCodeDto[];

  @ValidateNested({ each: true })
  @Type(() => ProcedureCodeDto)
  @IsArray()
  @IsOptional()
  procedureCodes: ProcedureCodeDto[];

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  clinicalNotes: string;

  @IsString()
  @IsNotEmpty()
  providerId: string;
}
