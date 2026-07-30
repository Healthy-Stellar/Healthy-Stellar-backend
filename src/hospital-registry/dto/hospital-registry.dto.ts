import { IsArray, IsEmail, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { HospitalStatus, HospitalType } from '../entities/hospital-registry.entity';

export class CreateHospitalRegistryDto {
  @IsString()
  name: string;

  @IsString()
  licenseNumber: string;

  @IsOptional() @IsEnum(HospitalType)
  type?: HospitalType;

  @IsString()
  address: string;

  @IsString()
  city: string;

  @IsString()
  country: string;

  @IsOptional() @IsString()
  phone?: string;

  @IsOptional() @IsEmail()
  email?: string;

  @IsOptional() @IsInt() @Min(0)
  totalBeds?: number;

  @IsOptional() @IsArray() @IsString({ each: true })
  departments?: string[];
}

export class UpdateHospitalRegistryDto {
  @IsOptional() @IsString()
  name?: string;

  @IsOptional() @IsEnum(HospitalType)
  type?: HospitalType;

  @IsOptional() @IsEnum(HospitalStatus)
  status?: HospitalStatus;

  @IsOptional() @IsString()
  address?: string;

  @IsOptional() @IsString()
  city?: string;

  @IsOptional() @IsString()
  country?: string;

  @IsOptional() @IsString()
  phone?: string;

  @IsOptional() @IsEmail()
  email?: string;

  @IsOptional() @IsInt() @Min(0)
  totalBeds?: number;

  @IsOptional() @IsArray() @IsString({ each: true })
  departments?: string[];
}
