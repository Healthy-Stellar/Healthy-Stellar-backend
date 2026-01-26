export class CreatePerformanceMetricDto {
  @IsString()
  doctorId: string;

  @IsDateString()
  periodStart: string;

  @IsDateString()
  periodEnd: string;

  @IsNumber()
  @Min(0)
  patientSatisfactionScore: number;

  @IsNumber()
  @Min(0)
  totalPatientsServed: number;

  @IsNumber()
  @Min(0)
  averageConsultationTime: number;

  @IsNumber()
  @Min(0)
  complicationsCases: number;

  @IsNumber()
  @Min(0)
  successfulTreatments: number;

  @IsOptional()
  @IsNumber()
  qualityScore?: number;
}

// src/medical-staff/dto/create-continuing-education.dto.ts
export class CreateContinuingEducationDto {
  @IsString()
  doctorId: string;

  @IsString()
  courseName: string;

  @IsString()
  provider: string;

  @IsNumber()
  @Min(0)
  creditsEarned: number;

  @IsDateString()
  completionDate: string;

  @IsOptional()
  @IsString()
  certificateNumber?: string;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @IsOptional()
  @IsString()
  description?: string;
}