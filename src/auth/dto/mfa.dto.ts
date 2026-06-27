import { IsString, IsOptional, IsNotEmpty, Length, Matches } from 'class-validator';

export class MfaSetupDto {
  @IsOptional()
  @IsString()
  @Length(1, 255)
  deviceName?: string;
}

export class MfaVerifyDto {
  @IsString()
  @Length(6, 6)
  code: string;
}

export class MfaEnableDto {
  @IsString()
  @Length(6, 6)
  verificationCode: string;

  @IsOptional()
  @IsString()
  @Length(1, 255)
  deviceName?: string;
}

export class BackupCodesDto {
  @IsString()
  @Length(6, 6)
  verificationCode: string;
}

export class VerifyBackupCodeDto {
  @IsString()
  @IsNotEmpty()
  @Length(8, 8, { message: 'Backup code must be exactly 8 characters' })
  @Matches(/^[A-Za-z0-9]+$/, { message: 'Backup code must contain only letters and digits' })
  code: string;
}
