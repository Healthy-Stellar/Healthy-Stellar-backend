// src/users/dto/user.dto.ts
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export enum UserRole {
  ADMIN = 'admin',
  EDITOR = 'editor',
  VIEWER = 'viewer',
}

// ── Response DTO ────────────────────────────────────────────────────────────
export class UserDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Unique user identifier (UUID v4)',
    format: 'uuid',
  })
  id: string;

  @ApiProperty({
    example: 'Jane Doe',
    description: 'Full display name',
    maxLength: 120,
  })
  name: string;

  @ApiProperty({
    example: 'jane.doe@example.com',
    description: 'Unique email address',
    format: 'email',
  })
  email: string;

  @ApiProperty({
    enum: UserRole,
    enumName: 'UserRole',
    example: UserRole.EDITOR,
    description: 'Access control role',
  })
  role: UserRole;

  @ApiProperty({
    example: true,
    description: 'Whether the account is active',
  })
  isActive: boolean;

  @ApiProperty({
    example: '2024-01-15T10:30:00.000Z',
    description: 'ISO 8601 creation timestamp',
    format: 'date-time',
  })
  createdAt: string;

  @ApiProperty({
    example: '2024-06-01T08:00:00.000Z',
    description: 'ISO 8601 last-updated timestamp',
    format: 'date-time',
  })
  updatedAt: string;
}

// ── Create DTO ──────────────────────────────────────────────────────────────
export class CreateUserDto {
  @ApiProperty({
    example: 'Jane Doe',
    description: 'Full display name',
    minLength: 2,
    maxLength: 120,
  })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @ApiProperty({
    example: 'jane.doe@example.com',
    description: 'Unique email address',
    format: 'email',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'P@ssword123',
    description: 'Initial password (min 8 characters)',
    minLength: 8,
    format: 'password',
  })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({
    enum: UserRole,
    enumName: 'UserRole',
    example: UserRole.VIEWER,
    description: 'Access control role (defaults to viewer)',
    default: UserRole.VIEWER,
  })
  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;
}

// ── Update DTO (all fields optional via PartialType) ─────────────────────────
export class UpdateUserDto extends PartialType(CreateUserDto) {}

// ── Query / filter DTO ──────────────────────────────────────────────────────
export class UserQueryDto {
  @ApiPropertyOptional({
    example: 1,
    description: 'Page number (1-indexed)',
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({
    example: 20,
    description: 'Items per page',
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({
    example: 'jane',
    description: 'Search by name or email (case-insensitive)',
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    enum: UserRole,
    enumName: 'UserRole',
    description: 'Filter by role',
  })
  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;
}
