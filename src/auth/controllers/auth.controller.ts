import {
  Controller,
  Post,
  Delete,
  Body,
  UseGuards,
  Get,
  Req,
  Param,
  BadRequestException,
  NotFoundException,
  Inject,
  Optional,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MAILER_SERVICE } from '../../notifications/services/notifications.service';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { API_BEARER_AUTH_SCHEME } from '../../common/constants/swagger.constants';
import { Request } from 'express';
import { AuthService, AuthResponse } from '../services/auth.service';
import { MfaService } from '../services/mfa.service';
import { SessionManagementService } from '../services/session-management.service';
import { AuthTokenService } from '../services/auth-token.service';
import { RefreshTokenStoreService } from '../services/refresh-token-store.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { JwtPayload } from '../services/auth-token.service';
import { RegisterDto, RegisterStaffDto, LoginDto, ChangePasswordDto, ResetPasswordDto, ResetPasswordConfirmDto } from '../dto/auth.dto';
import { RefreshTokenDto } from '../dto/session.dto';
import { User, UserRole } from '../entities/user.entity';
import { AuthRateLimit } from '../../common/throttler/throttler.decorator';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private authService: AuthService,
    private mfaService: MfaService,
    private sessionManagementService: SessionManagementService,
    private authTokenService: AuthTokenService,
    private refreshTokenStore: RefreshTokenStoreService,
    @Optional() private configService?: ConfigService,
    @Optional() @Inject(MAILER_SERVICE) private mailerService?: any,
  ) {}

  /**
   * Register new user (healthcare staff or patient)
   */
  @Post('register')
  @AuthRateLimit() // 10 requests per minute
  @ApiOperation({ summary: 'Register new user' })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  async register(@Body() registerDto: RegisterDto, @Req() req: Request): Promise<AuthResponse> {
    return this.authService.register(
      registerDto,
      UserRole.PATIENT,
      this.getIpAddress(req),
      req.get('user-agent'),
    );
  }

  /**
   * Register healthcare staff (admin / super admin only)
   */
  @Post('register/staff')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth(API_BEARER_AUTH_SCHEME)
  @AuthRateLimit() // 10 requests per minute
  @ApiOperation({ summary: 'Register healthcare staff with role (admin only)' })
  @ApiResponse({ status: 201, description: 'Staff registered successfully' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Caller may not create this role' })
  async registerStaff(
    @Body() body: RegisterStaffDto,
    @Req() req: Request,
  ): Promise<{ user: AuthResponse['user'] }> {
    return this.authService.registerStaff(body, req.user as JwtPayload, this.getIpAddress(req));
  }

  /**
   * Login user
   */
  @Post('login')
  @AuthRateLimit() // 10 requests per minute
  @ApiOperation({ summary: 'Login user' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() loginDto: LoginDto, @Req() req: Request): Promise<AuthResponse> {
    return this.authService.login(loginDto, this.getIpAddress(req), req.get('user-agent'));
  }

  /**
   * Refresh access token — full rotation with reuse detection
   */
  @Post('refresh')
  @AuthRateLimit()
  @ApiOperation({ summary: 'Refresh access token (rotates refresh token)' })
  @ApiResponse({ status: 200, description: 'New token pair issued' })
  @ApiResponse({ status: 401, description: 'Invalid, expired, or replayed refresh token' })
  async refreshToken(
    @Body() { refreshToken }: RefreshTokenDto,
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    // 1. Verify JWT signature and expiry
    const payload = this.authTokenService.verifyRefreshToken(refreshToken);
    if (!payload || payload.type !== 'refresh') {
      throw new BadRequestException('Invalid refresh token');
    }

    // 2. Validate against Redis store — detects reuse attacks, marks old token consumed
    await this.refreshTokenStore.consumeAndValidate(payload.sessionId, refreshToken);

    // 3. Load user
    const user = await this.authService.getUserById(payload.userId);
    if (!user || !user.isActive) {
      throw new BadRequestException('User not found or inactive');
    }

    // 4. Issue new token pair
    const tokens = this.authTokenService.generateTokenPair(user, payload.sessionId, user.mfaEnabled);

    // 5. Persist new refresh token in Redis and update DB session
    await this.refreshTokenStore.store(payload.sessionId, tokens.refreshToken);

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    const refreshTokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await this.sessionManagementService.refreshSession(
      payload.sessionId,
      tokens.accessToken,
      tokens.refreshToken,
      expiresAt,
      refreshTokenExpiresAt,
    );

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
    };
  }

  /**
   * Revoke all sessions for the authenticated user and clear Redis tokens
   */
  @Delete('sessions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth(API_BEARER_AUTH_SCHEME)
  @ApiOperation({ summary: 'Revoke all sessions (logout everywhere)' })
  @ApiResponse({ status: 200, description: 'All sessions revoked' })
  async revokeAllSessionsDelete(@Req() req: Request): Promise<{ message: string }> {
    const user = req.user as JwtPayload;
    const sessions = await this.sessionManagementService.getUserSessions(user.userId);
    await Promise.all(
      sessions.map((s) =>
        Promise.all([
          this.sessionManagementService.revokeSession(s.id),
          this.refreshTokenStore.revokeSession(s.id),
        ]),
      ),
    );
    return { message: 'All sessions revoked' };
  }

  /**
   * Request password reset — sends token via email; silent on unknown email (enum protection)
   */
  @Post('forgot-password')
  @AuthRateLimit()
  @ApiOperation({ summary: 'Request a password reset email' })
  @ApiResponse({ status: 200, description: 'Reset email sent if account exists' })
  async forgotPassword(@Body() { email }: ResetPasswordDto): Promise<{ message: string }> {
    const result = await this.authService.forgotPassword(email);
    if (result) {
      const frontendUrl =
        this.configService?.get<string>('FRONTEND_URL') ||
        process.env.FRONTEND_URL ||
        'http://localhost:3000';
      const resetLink = `${frontendUrl.replace(/\/$/, '')}/reset-password?token=${result.token}`;

      if (this.mailerService) {
        try {
          await this.mailerService.sendMail({
            to: email,
            subject: 'Password Reset Request',
            text: `You requested a password reset. Please use the following link to reset your password: ${resetLink}\n\nThis link expires in 15 minutes. If you did not request this, please ignore this email.`,
            html: `<p>You requested a password reset.</p><p><a href="${resetLink}">Click here to reset your password</a></p><p>This link expires in 15 minutes. If you did not request this, please ignore this email.</p>`,
          });
        } catch (err: any) {
          this.logger.error(`Failed to send password reset email to ${email}: ${err?.message}`);
        }
      } else {
        this.logger.log(`[Security Email] Password reset requested for ${email}`);
      }
    }
    return { message: 'If that email is registered, a reset link has been sent' };
  }

  /**
   * Consume a reset token and set a new password (token is invalidated on first use)
   */
  @Post('reset-password')
  @AuthRateLimit()
  @ApiOperation({ summary: 'Reset password using a valid one-time token' })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 400, description: 'Invalid, expired, or already-used token' })
  async resetPassword(@Body() body: ResetPasswordConfirmDto): Promise<{ message: string }> {
    await this.authService.resetPassword(body.token, body.newPassword);
    return { message: 'Password reset successfully' };
  }

  /**
   * Change password
   */
  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Change user password' })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  async changePassword(
    @Body() changePasswordDto: ChangePasswordDto,
    @Req() req: Request,
  ): Promise<{ message: string }> {
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
      userAgent: session.userAgent,
      deviceId: session.deviceId,
      lastActive: session.updatedAt,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
    }));
  }

  /**
   * Terminate a specific session
   */
  @Delete('sessions/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth(API_BEARER_AUTH_SCHEME)
  @ApiOperation({ summary: 'Terminate a specific session' })
  @ApiResponse({ status: 200, description: 'Session terminated' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async deleteSession(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<{ message: string }> {
    const user = req.user as JwtPayload;
    const session = await this.sessionManagementService.getUserSessions(user.userId).then(
      (sessions) => sessions.find((s) => s.id === id),
    );
    if (!session) {
      throw new NotFoundException('Session not found');
    }
    await Promise.all([
      this.sessionManagementService.revokeSession(id),
      this.refreshTokenStore.revokeSession(id),
    ]);
    return { message: 'Session terminated' };
  }

  /**
   * Revoke session (legacy endpoint)
   */
  @Post('sessions/:sessionId/revoke')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Revoke a specific session' })
  async revokeSession(
    @Param('sessionId') sessionId: string,
    @Req() req: Request,
  ): Promise<{ message: string }> {
    const user = req.user as JwtPayload;
    const session = await this.sessionManagementService.getUserSessions(user.userId).then(
      (sessions) => sessions.find((s) => s.id === sessionId),
    );
    if (!session) {
      throw new NotFoundException('Session not found');
    }
    await Promise.all([
      this.sessionManagementService.revokeSession(sessionId),
      this.refreshTokenStore.revokeSession(sessionId),
    ]);
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
        await Promise.all([
          this.sessionManagementService.revokeSession(session.id),
          this.refreshTokenStore.revokeSession(session.id),
        ]);
      }
    }

    return { message: 'All other sessions revoked' };
  }

  private getIpAddress(req: Request): string {
    return (req.ip || req.socket.remoteAddress || 'unknown').toString();
  }
}
