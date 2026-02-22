import { Controller, Post, Body, UseGuards, Get, Req, BadRequestException, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { AuthService, AuthResponse } from '../services/auth.service';
import { MfaService } from '../services/mfa.service';
import { SessionManagementService } from '../services/session-management.service';
import { AuthTokenService } from '../services/auth-token.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { JwtPayload } from '../services/auth-token.service';
import { RegisterDto, LoginDto, ChangePasswordDto } from '../dto/auth.dto';
import { RefreshTokenDto } from '../dto/session.dto';
import { User, UserRole } from '../entities/user.entity';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private mfaService: MfaService,
    private sessionManagementService: SessionManagementService,
    private authTokenService: AuthTokenService,
  ) {}

  /**
   * Register new user (healthcare staff or patient)
   */
  @Post('register')
  @Throttle({ ip: { limit: 10, ttl: 60 }, user: { limit: 10, ttl: 60 } })
  @ApiOperation({ summary: 'Register new user' })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  async register(@Body() registerDto: RegisterDto, @Req() req: Request): Promise<AuthResponse> {
    return this.authService.register(registerDto, UserRole.PATIENT, this.getIpAddress(req), req.get('user-agent'));
  }

  /**
   * Register healthcare staff
   */
  @Post('register/staff')
  @Throttle({ ip: { limit: 10, ttl: 60 }, user: { limit: 10, ttl: 60 } })
  @ApiOperation({ summary: 'Register healthcare staff with role' })
  @ApiResponse({ status: 201, description: 'Staff registered successfully' })
  async registerStaff(
    @Body()
    body: RegisterDto & { role: UserRole; npi?: string; licenseNumber?: string },
    @Req() req: Request,
  ): Promise<AuthResponse> {
    if (!body.role || !Object.values(UserRole).includes(body.role)) {
      throw new BadRequestException('Invalid role');
    }

    if (body.role === UserRole.PATIENT) {
      throw new BadRequestException('Use /register endpoint for patient registration');
    }

    const result = await this.authService.register(body, body.role, this.getIpAddress(req), req.get('user-agent'));

    // Staff requires MFA setup immediately
    return result;
  }

  /**
   * Login user
   */
  @Post('login')
  @Throttle({ ip: { limit: 10, ttl: 60 }, user: { limit: 10, ttl: 60 } })
  @ApiOperation({ summary: 'Login user' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() loginDto: LoginDto, @Req() req: Request): Promise<AuthResponse> {
    return this.authService.login(loginDto, this.getIpAddress(req), req.get('user-agent'));
  }

  /**
   * Refresh access token
   */
  @Post('refresh')
  @Throttle({ ip: { limit: 10, ttl: 60 }, user: { limit: 10, ttl: 60 } })
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully' })
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto): Promise<{ accessToken: string; expiresIn: number }> {
    const payload = this.authTokenService.verifyRefreshToken(refreshTokenDto.refreshToken);

    if (!payload) {
      throw new BadRequestException('Invalid refresh token');
    }

    // Get session and user
    const session = await this.sessionManagementService.getSession(payload.sessionId);
    if (!session) {
      throw new NotFoundException('Session not found');
    }

    const user = await this.authService.getUserById(payload.userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Generate new tokens
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    const refreshTokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const tokens = this.authTokenService.generateTokenPair(user, payload.sessionId, user.mfaEnabled);

    await this.sessionManagementService.refreshSession(
      payload.sessionId,
      tokens.accessToken,
      tokens.refreshToken,
      expiresAt,
      refreshTokenExpiresAt,
    );

    return {
      accessToken: tokens.accessToken,
      expiresIn: tokens.expiresIn,
    };
  }

  /**
   * Change password
   */
  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Change user password' })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  async changePassword(@Body() changePasswordDto: ChangePasswordDto, @Req() req: Request): Promise<{ message: string }> {
    const user = req.user as JwtPayload;
    await this.authService.changePassword(user.userId, changePasswordDto, this.getIpAddress(req));
    return { message: 'Password changed successfully' };
  }

  /**
   * Logout user
   */
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Logout user' })
  @ApiResponse({ status: 200, description: 'Logout successful' })
  async logout(@Req() req: Request): Promise<{ message: string }> {
    const user = req.user as JwtPayload;
    const sessionId = (req as any).sessionId;
    await this.authService.logout(user.userId, sessionId, this.getIpAddress(req));
    return { message: 'Logged out successfully' };
  }

  /**
   * Get current user
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'User profile retrieved' })
  async getCurrentUser(@Req() req: Request): Promise<User> {
    const user = req.user as JwtPayload;
    return this.authService.getUserById(user.userId);
  }

  /**
   * Get user sessions
   */
  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get all active sessions' })
  @ApiResponse({ status: 200, description: 'Sessions retrieved' })
  async getSessions(@Req() req: Request): Promise<any[]> {
    const user = req.user as JwtPayload;
    const sessions = await this.sessionManagementService.getUserSessions(user.userId);
    return sessions.map((session) => ({
      id: session.id,
      ipAddress: session.ipAddress,
      deviceId: session.deviceId,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
    }));
  }

  /**
   * Revoke session
   */
  @Post('sessions/:sessionId/revoke')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Revoke a specific session' })
  async revokeSession(@Req() req: Request, sessionId: string): Promise<{ message: string }> {
    const user = req.user as JwtPayload;
    // Verify session belongs to user
    const session = await this.sessionManagementService.getSession(sessionId);
    if (!session || session.userId !== user.userId) {
      throw new NotFoundException('Session not found');
    }

    await this.sessionManagementService.revokeSession(sessionId);
    return { message: 'Session revoked' };
  }

  /**
   * Revoke all sessions (except current)
   */
  @Post('sessions/revoke-all')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Revoke all sessions except current' })
  async revokeAllSessions(@Req() req: Request): Promise<{ message: string }> {
    const user = req.user as JwtPayload;
    const currentSessionId = (req as any).sessionId;
    const sessions = await this.sessionManagementService.getUserSessions(user.userId);

    for (const session of sessions) {
      if (session.id !== currentSessionId) {
        await this.sessionManagementService.revokeSession(session.id);
      }
    }

    return { message: 'All other sessions revoked' };
  }

  private getIpAddress(req: Request): string {
    return (req.ip || req.socket.remoteAddress || 'unknown').toString();
  }
}
