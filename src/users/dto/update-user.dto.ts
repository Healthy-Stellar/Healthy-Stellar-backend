import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { UserStatus } from '../../auth/entities/user.entity';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @IsEnum(UserStatus)
  @IsOptional()
  status?: UserStatus;

  @IsBoolean()
  @IsOptional()
  isLicenseVerified?: boolean;

  @IsString()
  @IsOptional()
  revocationReason?: string;
}
