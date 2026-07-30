// src/auth/dto/login.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'jane.doe@example.com',
    description: 'Registered email address',
    format: 'email',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'P@ssword123',
    description: 'Account password (min 8 characters)',
    minLength: 8,
    format: 'password',
  })
  @IsString()
  @MinLength(8)
  password: string;
}

export class LoginResponseDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'Signed JWT – include in Authorization: Bearer <token>',
  })
  accessToken: string;

  @ApiProperty({ example: 3600, description: 'Token TTL in seconds' })
  expiresIn: number;

  @ApiProperty({ example: 'Bearer', description: 'Token type' })
  tokenType: string;
}

export class RefreshTokenDto {
  @ApiProperty({
    example: 'dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4...',
    description: 'Refresh token obtained during login',
  })
  @IsString()
  refreshToken: string;
}
