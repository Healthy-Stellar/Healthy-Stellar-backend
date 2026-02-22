import { Controller, Post, Get, UseGuards, Body, Req, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { MfaService } from '../services/mfa.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { JwtPayload } from '../services/auth-token.service';
import { MfaSetupDto, MfaVerifyDto, MfaEnableDto, BackupCodesDto } from '../dto/mfa.dto';
import { AuditService } from '../../common/audit/audit.service';
import { AuditAction } from '../../common/audit/audit-log.entity';

@ApiTags('Multi-Factor Authentication')
@Controller('auth/mfa')
export class MfaController {
  constructor(
    private mfaService: MfaService,
    private auditService: AuditService,
  ) {}

  /**
   * Initialize MFA setup
   */
  @Post('setup')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Initialize MFA setup - returns secret and QR code' })
  @ApiResponse({ status: 200, description: 'MFA setup initialized' })
  async setupMfa(@Body() mfaSetupDto: MfaSetupDto, @Req() req: Request): Promise<any> {
    const user = req.user as JwtPayload;
    try {
      const result = await this.mfaService.setupMfa(user.userId, mfaSetupDto.deviceName);

      await this.auditService.logAuthenticationEvent(AuditAction.MFA_ENABLED, true, {
        userId: user.userId,
        description: 'MFA setup initiated',
        ipAddress: this.getIpAddress(req),
      });

      return {
        secret: result.secret,
        qrCode: result.qrCode,
        backupCodes: result.backupCodes,
        message: 'Scan QR code with authenticator app and verify the code',
      };
    } catch (error) {
      await this.auditService.logAuthenticationEvent(AuditAction.MFA_ENABLED, false, {
        userId: user.userId,
        reason: error.message,
        ipAddress: this.getIpAddress(req),
        severity: 'MEDIUM',
      });
      throw error;
    }
  }

  /**
   * Verify and enable MFA
   */
  @Post('verify')
  @UseGuards(JwtAuthGuard)
  @Throttle({ user: { limit: 5, ttl: 60 } })
  @ApiOperation({ summary: 'Verify MFA code and enable MFA' })
  @ApiResponse({ status: 200, description: 'MFA enabled successfully' })
  async verifyMfa(@Body() mfaEnableDto: MfaEnableDto, @Req() req: Request): Promise<any> {
    const user = req.user as JwtPayload;
    try {
      const result = await this.mfaService.verifyAndEnableMfa(
        user.userId,
        mfaEnableDto.verificationCode,
        mfaEnableDto.deviceName,
      );

      await this.auditService.logAuthenticationEvent(AuditAction.MFA_VERIFIED, true, {
        userId: user.userId,
        ipAddress: this.getIpAddress(req),
      });

      return {
        success: true,
        message: result.message,
        backupCodes: result.backupCodes,
        warning: 'Save backup codes in a secure location. You can use them to access your account if you lose access to your authenticator.',
      };
    } catch (error) {
      await this.auditService.logAuthenticationEvent(AuditAction.MFA_VERIFIED, false, {
        userId: user.userId,
        reason: error.message,
        ipAddress: this.getIpAddress(req),
        severity: 'HIGH',
      });
      throw error;
    }
  }

  /**
   * Verify MFA code (during login or action verification)
   */
  @Post('verify-code')
  @UseGuards(JwtAuthGuard)
  @Throttle({ user: { limit: 5, ttl: 60 }, ip: { limit: 20, ttl: 60 } })
  @ApiOperation({ summary: 'Verify MFA code' })
  @ApiResponse({ status: 200, description: 'MFA code verified' })
  async verifyCode(@Body() mfaVerifyDto: MfaVerifyDto, @Req() req: Request): Promise<any> {
    const user = req.user as JwtPayload;
    if (!/^\d{6}$/.test(mfaVerifyDto.code)) {
      throw new BadRequestException('Invalid code format');
    }

    const isValid = await this.mfaService.verifyMfaCode(user.userId, mfaVerifyDto.code);

    if (!isValid) {
      await this.auditService.logAuthenticationEvent(AuditAction.MFA_VERIFIED, false, {
        userId: user.userId,
        reason: 'Invalid MFA code',
        ipAddress: this.getIpAddress(req),
        severity: 'MEDIUM',
      });
      throw new BadRequestException('Invalid MFA code');
    }

    return { success: true, message: 'MFA code verified' };
  }

  /**
   * Get MFA devices
   */
  @Get('devices')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get all MFA devices' })
  @ApiResponse({ status: 200, description: 'MFA devices retrieved' })
  async getDevices(@Req() req: Request): Promise<any[]> {
    const user = req.user as JwtPayload;
    const devices = await this.mfaService.getMfaDevices(user.userId);
    return devices.map((device) => ({
      id: device.id,
      name: device.deviceName,
      isPrimary: device.isPrimary,
      createdAt: device.createdAt,
      lastUsedAt: device.lastUsedAt,
      remainingBackupCodes: device.backupCodes ? device.backupCodes.length : 0,
    }));
  }

  /**
   * Generate new backup codes
   */
  @Post('backup-codes/regenerate')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Generate new backup codes' })
  @ApiResponse({ status: 200, description: 'New backup codes generated' })
  async regenerateBackupCodes(
    @Body() backupCodesDto: BackupCodesDto,
    @Req() req: Request,
  ): Promise<any> {
    const user = req.user as JwtPayload;
    // Verify with MFA code first
    const isValid = await this.mfaService.verifyMfaCode(user.userId, backupCodesDto.verificationCode);

    if (!isValid) {
      throw new BadRequestException('Invalid MFA code');
    }

    const newCodes = await this.mfaService.generateNewBackupCodes(user.userId);

    await this.auditService.logAuthenticationEvent(AuditAction.MFA_ENABLED, true, {
      userId: user.userId,
      description: 'Backup codes regenerated',
      ipAddress: this.getIpAddress(req),
      severity: 'MEDIUM',
    });

    return {
      success: true,
      backupCodes: newCodes,
      message: 'New backup codes generated',
    };
  }

  /**
   * Disable MFA
   */
  @Post('disable')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Disable MFA' })
  @ApiResponse({ status: 200, description: 'MFA disabled' })
  async disableMfa(@Body() backupCodesDto: BackupCodesDto, @Req() req: Request): Promise<any> {
    const user = req.user as JwtPayload;
    // Verify with MFA code first
    const isValid = await this.mfaService.verifyMfaCode(user.userId, backupCodesDto.verificationCode);

    if (!isValid) {
      throw new BadRequestException('Invalid MFA code');
    }

    await this.mfaService.disableMfa(user.userId);

    await this.auditService.logAuthenticationEvent(AuditAction.MFA_DISABLED, true, {
      userId: user.userId,
      ipAddress: this.getIpAddress(req),
      severity: 'HIGH',
    });

    return { success: true, message: 'MFA has been disabled' };
  }

  private getIpAddress(req: Request): string {
    return (req.ip || req.socket.remoteAddress || 'unknown').toString();
  }
}
