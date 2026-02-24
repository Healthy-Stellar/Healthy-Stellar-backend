import { IsString, IsNotEmpty, IsOptional, IsArray, IsBoolean } from 'class-validator';

export class VerifyPrescriptionDto {
  @IsString()
  @IsNotEmpty()
  pharmacistId: string;

  @IsString()
  @IsNotEmpty()
  pharmacistName: string;

  @IsString()
  @IsNotEmpty()
  pharmacistLicense: string;

  @IsArray()
  @IsOptional()
  acknowledgedAlertIds?: string[];

  @IsString()
  @IsOptional()
  verificationNotes?: string;

  @IsBoolean()
  @IsOptional()
  requiresCounseling?: boolean;

  @IsString()
  @IsOptional()
  counselingTopics?: string;
}
