import { IsEmail, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class EmergencyContactDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsString()
  @MaxLength(20)
  phone: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  relationship?: string;
}

class ContactPreferencesDto {
  @IsOptional()
  @IsString()
  preferredChannel?: 'email' | 'sms' | 'phone';

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  timezone?: string;
}

export class UpdatePatientProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  address?: Record<string, any>;

  @IsOptional()
  @ValidateNested()
  @Type(() => ContactPreferencesDto)
  contactPreferences?: ContactPreferencesDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => EmergencyContactDto)
  emergencyContact?: EmergencyContactDto;

  @IsOptional()
  @IsString()
  primaryLanguage?: string;

  @IsOptional()
  @IsString()
  genderIdentity?: string;
}
