import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsDateString,
  MinLength,
} from 'class-validator';
import { MedicalRole } from '../enums/medical-role.enum';

export class CreateUserDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsEnum(MedicalRole)
  role: MedicalRole;

  @IsString()
  @IsOptional()
  medicalLicenseNumber?: string;

  @IsDateString()
  @IsOptional()
  licenseExpiryDate?: string;

  @IsString()
  @IsOptional()
  specialization?: string;

  @IsString()
  @IsOptional()
  department?: string;
}
