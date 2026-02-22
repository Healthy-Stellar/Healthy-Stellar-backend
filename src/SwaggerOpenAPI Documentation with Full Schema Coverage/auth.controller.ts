// src/auth/auth.controller.ts
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { LoginDto, LoginResponseDto, RefreshTokenDto } from './dto/auth.dto';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { ApiEndpoint } from '../common/decorators/api-endpoint.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  // ── POST /auth/login ────────────────────────────────────────────────────
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Authenticate and obtain a JWT',
    description:
      'Validates credentials and returns a signed JWT access token. ' +
      'Pass the token as `Authorization: Bearer <token>` on subsequent requests.',
    operationId: 'login',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Authentication successful.',
    type: LoginResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Validation error – missing or malformed fields.',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid email / password combination.',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Unexpected server error.',
    type: ErrorResponseDto,
  })
  login(@Body() dto: LoginDto): LoginResponseDto {
    // implementation omitted – service handles business logic
    return {
      accessToken: 'eyJ...',
      expiresIn: 3600,
      tokenType: 'Bearer',
    };
  }

  // ── POST /auth/refresh ──────────────────────────────────────────────────
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiEndpoint({
    summary: 'Refresh an expired access token',
    description: 'Exchange a valid refresh token for a new access token.',
    operationId: 'refreshToken',
    type: LoginResponseDto,
    auth: false, // no bearer needed – uses refresh token in body
  })
  refresh(@Body() dto: RefreshTokenDto): LoginResponseDto {
    return { accessToken: 'eyJ...new', expiresIn: 3600, tokenType: 'Bearer' };
  }

  // ── POST /auth/logout ───────────────────────────────────────────────────
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Revoke the current session',
    description: 'Invalidates the bearer token server-side.',
    operationId: 'logout',
  })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'Logged out.' })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid token.',
    type: ErrorResponseDto,
  })
  logout(): void {
    // service.logout(req.user)
  }
}
