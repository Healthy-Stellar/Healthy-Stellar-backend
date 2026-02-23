import { IsString, IsOptional, IsUUID, IsEnum, IsDateString, IsIP } from 'class-validator';

export enum AuditEventAction {
  RECORD_READ = 'RECORD_READ',
  RECORD_WRITE = 'RECORD_WRITE',
  ACCESS_GRANTED = 'ACCESS_GRANTED',
  ACCESS_REVOKED = 'ACCESS_REVOKED',
}

export class AuditEventDto {
  @IsUUID()
  actorId: string;

  @IsEnum(AuditEventAction)
  action: AuditEventAction | string;

  @IsUUID()
  @IsOptional()
  resourceId?: string;

  @IsString()
  @IsOptional()
  resourceType?: string;

  @IsIP()
  @IsOptional()
  ipAddress?: string;

  @IsString()
  @IsOptional()
  userAgent?: string;

  @IsDateString()
  @IsOptional()
  timestamp?: Date;

  /** Optional Stellar transaction hash for tamper-evidence anchoring */
  @IsString()
  @IsOptional()
  stellarTxHash?: string;
}
