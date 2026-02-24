import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import { MfaEntity } from '../entities/mfa.entity';
import { User } from '../entities/user.entity';

export interface MfaSetupResponse {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

export interface MfaVerificationResult {
  success: boolean;
  message: string;
  backupCodes?: string[];
}

@Injectable()
export class MfaService {
  constructor(
    @InjectRepository(MfaEntity)
    private mfaRepository: Repository<MfaEntity>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  /**
   * Initialize MFA setup for user - generate secret and QR code
   */
  async setupMfa(userId: string, deviceName?: string): Promise<MfaSetupResponse> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Generate TOTP secret
    const secret = speakeasy.generateSecret({
      name: `Healthy Stellar (${user.email})`,
      issuer: 'Healthy Stellar',
      length: 32, // 256-bit entropy
    });

    // Generate QR code
    const qrCode = await QRCode.toDataURL(secret.otpauth_url);

    // Generate backup codes (8 codes, 8 characters each)
    const backupCodes = this.generateBackupCodes(8);

    return {
      secret: secret.base32,
      qrCode,
      backupCodes,
    };
  }

  /**
   * Verify MFA setup and save to database
   */
  async verifyAndEnableMfa(
    userId: string,
    verificationCode: string,
    deviceName?: string,
  ): Promise<MfaVerificationResult> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // The secret should be stored temporarily in the session
    // For now, we'll generate a new one
    const secret = speakeasy.generateSecret({
      name: `Healthy Stellar (${user.email})`,
      issuer: 'Healthy Stellar',
      length: 32,
    });

    // Verify the code
    const verified = speakeasy.totp.verify({
      secret: secret.base32,
      encoding: 'base32',
      token: verificationCode,
      window: 2, // Allow 30 seconds before/after
    });

    if (!verified) {
      throw new BadRequestException('Invalid verification code');
    }

    // Generate backup codes
    const backupCodes = this.generateBackupCodes(8);

    // Create and save MFA device
    const mfaDevice = this.mfaRepository.create({
      userId,
      secret: secret.base32,
      backupCodes,
      isVerified: true,
      verifiedAt: new Date(),
      deviceName: deviceName || 'Primary Device',
      isPrimary: true,
    });

    await this.mfaRepository.save(mfaDevice);

    // Update user to enable MFA
    user.mfaEnabled = true;
    user.mfaSecret = secret.base32;
    await this.userRepository.save(user);

    return {
      success: true,
      message: 'MFA enabled successfully',
      backupCodes,
    };
  }

  /**
   * Verify MFA code during login
   */
  async verifyMfaCode(userId: string, code: string): Promise<boolean> {
    const mfaDevice = await this.mfaRepository.findOne({
      where: {
        userId,
        isActive: true,
        isPrimary: true,
      },
    });

    if (!mfaDevice) {
      throw new NotFoundException('MFA device not found');
    }

    // Try to verify with TOTP
    const isValid = speakeasy.totp.verify({
      secret: mfaDevice.secret,
      encoding: 'base32',
      token: code,
      window: 2,
    });

    if (isValid) {
      // Update last used timestamp
      mfaDevice.lastUsedAt = new Date();
      await this.mfaRepository.save(mfaDevice);
      return true;
    }

    // Try backup codes
    return this.verifyBackupCode(mfaDevice, code);
  }

  /**
   * Verify backup code
   */
  private async verifyBackupCode(mfaDevice: MfaEntity, code: string): Promise<boolean> {
    if (!mfaDevice.backupCodes || !mfaDevice.backupCodes.includes(code)) {
      return false;
    }

    // Remove used backup code
    mfaDevice.backupCodes = mfaDevice.backupCodes.filter((c) => c !== code);
    mfaDevice.lastUsedAt = new Date();
    await this.mfaRepository.save(mfaDevice);

    return true;
  }

  /**
   * Generate new backup codes
   */
  async generateNewBackupCodes(userId: string): Promise<string[]> {
    const mfaDevice = await this.mfaRepository.findOne({
      where: {
        userId,
        isPrimary: true,
      },
    });

    if (!mfaDevice) {
      throw new NotFoundException('MFA device not found');
    }

    const newBackupCodes = this.generateBackupCodes(8);
    mfaDevice.backupCodes = newBackupCodes;
    await this.mfaRepository.save(mfaDevice);

    return newBackupCodes;
  }

  /**
   * Disable MFA
   */
  async disableMfa(userId: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Deactivate all MFA devices
    await this.mfaRepository.update({ userId }, { isActive: false });

    // Update user
    user.mfaEnabled = false;
    user.mfaSecret = null;
    await this.userRepository.save(user);
  }

  /**
   * Get MFA devices for user
   */
  async getMfaDevices(userId: string): Promise<MfaEntity[]> {
    return this.mfaRepository.find({
      where: { userId, isActive: true },
    });
  }

  /**
   * Generate backup codes (8 characters, alphanumeric)
   */
  private generateBackupCodes(count: number): string[] {
    const codes: string[] = [];
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

    for (let i = 0; i < count; i++) {
      let code = '';
      for (let j = 0; j < 8; j++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      codes.push(code);
    }

    return codes;
  }

  /**
   * Check if user has MFA enabled
   */
  async isMfaEnabled(userId: string): Promise<boolean> {
    const mfaDevice = await this.mfaRepository.findOne({
      where: {
        userId,
        isActive: true,
        isVerified: true,
      },
    });

    return !!mfaDevice;
  }
}
