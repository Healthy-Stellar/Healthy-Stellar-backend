import { IsString, IsNotEmpty, IsOptional, IsInt, Min } from 'class-validator';

export class RefillPrescriptionDto {
  @IsString()
  @IsNotEmpty()
  originalPrescriptionId: string;

  @IsString()
  @IsNotEmpty()
  pharmacistId: string;

  @IsString()
  @IsNotEmpty()
  pharmacistName: string;

  @IsInt()
  @Min(1)
  refillNumber: number;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  patientRequestDate?: string;
}
