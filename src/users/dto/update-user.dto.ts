import { IsBoolean, IsDateString, IsOptional, IsString } from 'class-validator';

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsString()
  @IsOptional()
  displayName?: string;

  @IsString()
  @IsOptional()
  country?: string;

  @IsBoolean()
  @IsOptional()
  isAcceptingPatients?: boolean;

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
