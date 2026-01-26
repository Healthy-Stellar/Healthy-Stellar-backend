import { IsString, IsEmail, IsEnum, IsArray, IsDateString, IsNumber, IsOptional, IsPhoneNumber, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';

class CredentialDto {
  @IsString()
  degree: string;

  @IsString()
  institution: string;

  @IsNumber()
  @Min(1900)
  graduationYear: number;
}

export class CreateDoctorDto {
  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsEmail()
  email: string;

  @IsPhoneNumber()
  phone: string;

  @IsDateString()
  dateOfBirth: string;

  @IsArray()
  @IsEnum(SpecializationType, { each: true })
  specializations: SpecializationType[];

  @IsString()
  medicalLicenseNumber: string;

  @IsDateString()
  licenseIssueDate: string;

  @IsDateString()
  licenseExpiryDate: string;

  @IsOptional()
  @IsString()
  boardCertification?: string;

  @IsOptional()
  @IsDateString()
  boardCertificationExpiry?: string;

  @IsNumber()
  @Min(0)
  yearsOfExperience: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CredentialDto)
  credentials?: CredentialDto[];

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsArray()
  specialtyIds?: string[];
}