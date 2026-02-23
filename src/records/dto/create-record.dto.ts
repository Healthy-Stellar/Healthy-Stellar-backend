import { IsString, IsEnum, IsOptional } from 'class-validator';

export enum RecordType {
  MEDICAL_REPORT = 'MEDICAL_REPORT',
  LAB_RESULT = 'LAB_RESULT',
  PRESCRIPTION = 'PRESCRIPTION',
  IMAGING = 'IMAGING',
  CONSULTATION = 'CONSULTATION',
}

export class CreateRecordDto {
  @IsString()
  patientId: string;

  @IsEnum(RecordType)
  recordType: RecordType;

  @IsOptional()
  @IsString()
  description?: string;
}
