import {
  IsString,
  IsOptional,
  IsDateString,
  IsEnum,
  IsEmail,
  IsArray,
  IsUUID,
  Length,
  MaxLength,
} from 'class-validator';

export class CreatePatientDto {
  // -----------------------------
  // Core Identifiers
  // -----------------------------
  @IsString()
  @MaxLength(50)
  firstName: string;

  @IsString()
  @MaxLength(50)
  lastName: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  middleName?: string;

  @IsDateString()
  dateOfBirth: string;

  @IsEnum(['male', 'female', 'other', 'unknown'])
  sex: 'male' | 'female' | 'other' | 'unknown';

  @IsOptional()
  @IsString()
  genderIdentity?: string;

  // -----------------------------
  // Medical Demographics
  // -----------------------------
  @IsOptional()
  @IsEnum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])
  bloodGroup?: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  knownAllergies?: string[];

  @IsOptional()
  @IsString()
  primaryLanguage?: string;

  @IsOptional()
  @IsString()
  nationality?: string;

  @IsOptional()
  @IsString()
  ethnicity?: string;

  @IsOptional()
  @IsEnum(['single', 'married', 'divorced', 'widowed', 'other'])
  maritalStatus?: 'single' | 'married' | 'divorced' | 'widowed' | 'other';

  // -----------------------------
  // Contact Information
  // -----------------------------
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  address?: Record<string, any>;

  // -----------------------------
  // Identification & Media
  // -----------------------------
  @IsOptional()
  @IsString()
  patientPhotoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  nationalId?: string;

  @IsOptional()
  @IsString()
  nationalIdType?: string; // Passport, SSN, NIN
}
