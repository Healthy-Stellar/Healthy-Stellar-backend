import { IsString, IsOptional, IsEnum, IsUUID, IsIP, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum AuditAction {
  // Record Operations
  RECORD_READ = 'RECORD_READ',
  RECORD_WRITE = 'RECORD_WRITE',
  RECORD_CREATE = 'RECORD_CREATE',
  RECORD_UPDATE = 'RECORD_UPDATE',
  RECORD_DELETE = 'RECORD_DELETE',
  RECORD_DOWNLOAD = 'RECORD_DOWNLOAD',
  RECORD_EXPORT = 'RECORD_EXPORT',
  
  // Access Control
  ACCESS_GRANT = 'ACCESS_GRANT',
  ACCESS_REVOKE = 'ACCESS_REVOKE',
  ACCESS_REQUEST = 'ACCESS_REQUEST',
  ACCESS_DENIED = 'ACCESS_DENIED',
  
  // Authentication
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILURE = 'LOGIN_FAILURE',
  LOGOUT = 'LOGOUT',
  
  // PHI Operations
  PHI_ACCESS = 'PHI_ACCESS',
  PHI_MODIFY = 'PHI_MODIFY',
  PHI_EXPORT = 'PHI_EXPORT',
  PHI_PRINT = 'PHI_PRINT',
  
  // Administrative
  USER_CREATED = 'USER_CREATED',
  USER_UPDATED = 'USER_UPDATED',
  USER_DELETED = 'USER_DELETED',
  ROLE_ASSIGNED = 'ROLE_ASSIGNED',
  ROLE_REVOKED = 'ROLE_REVOKED',
  
  // Security Events
  SECURITY_VIOLATION = 'SECURITY_VIOLATION',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
}

export enum ResourceType {
  RECORD = 'RECORD',
  PATIENT = 'PATIENT',
  USER = 'USER',
  ACCESS_GRANT = 'ACCESS_GRANT',
  APPOINTMENT = 'APPOINTMENT',
  PRESCRIPTION = 'PRESCRIPTION',
  LAB_RESULT = 'LAB_RESULT',
  IMAGING = 'IMAGING',
  SYSTEM = 'SYSTEM',
}

export class AuditEventDto {
  @ApiProperty({
    description: 'ID of the user performing the action',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  actorId: string;

  @ApiProperty({
    description: 'Action being performed',
    enum: AuditAction,
    example: AuditAction.RECORD_READ,
  })
  @IsEnum(AuditAction)
  action: AuditAction;

  @ApiProperty({
    description: 'ID of the resource being accessed',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  @IsString()
  resourceId: string;

  @ApiProperty({
    description: 'Type of resource being accessed',
    enum: ResourceType,
    example: ResourceType.RECORD,
  })
  @IsEnum(ResourceType)
  resourceType: ResourceType;

  @ApiPropertyOptional({
    description: 'IP address of the actor',
    example: '192.168.1.1',
  })
  @IsOptional()
  @IsIP()
  ipAddress?: string;

  @ApiPropertyOptional({
    description: 'User agent string from the request',
    example: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  })
  @IsOptional()
  @IsString()
  userAgent?: string;

  @ApiPropertyOptional({
    description: 'Timestamp of the event (ISO 8601)',
    example: '2024-01-15T10:30:00Z',
  })
  @IsOptional()
  @IsDateString()
  timestamp?: string;

  @ApiPropertyOptional({
    description: 'Stellar transaction hash for tamper-evidence',
    example: 'a1b2c3d4e5f6...',
  })
  @IsOptional()
  @IsString()
  stellarTxHash?: string;

  @ApiPropertyOptional({
    description: 'Additional metadata about the event',
    example: { fileName: 'patient-record.pdf', fileSize: 1024 },
  })
  @IsOptional()
  metadata?: Record<string, any>;
}
