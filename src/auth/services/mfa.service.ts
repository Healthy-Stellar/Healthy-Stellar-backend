import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
  Inject,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import * as argon2 from 'argon2';
import { MfaEntity } from '../entities/mfa.entity';
import { User } from '../entities/user.entity';
import { MAILER_SERVICE } from '../../notifications/services/notifications.service';

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
  private readonly logger = new Logger(MfaService.name);

  constructor(
    @InjectRepository(MfaEntity)
    private mfaRepository: Repository<MfaEntity>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @Optional() @Inject(MAILER_SERVICE) private mailerService?: any,
  ) {}

  /**
   * Initialize MFA setup for user - generate secret and QR code
   */
  async setupMfa(userId: string, deviceName?: string): Promise<MfaSetupResponse> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const secret = speakeasy.generateSecret({
      name: `Healthy Stellar (${user.email})`,
      issuer: 'Healthy Stellar',
      length: 32, // 256-bit entropy
    });

    const qrCode = await QRCode.toDataURL(secret.otpauth_url);

    // Preview codes shown once during setup; actual hashes stored on verify
    const { plain } = await this.generateBackupCodes(10);

    return {
      secret: secret.base32,
      qrCode,
      backupCodes: plain,
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

    const secret = speakeasy.generateSecret({
      name: `Healthy Stellar (${user.email})`,
      issuer: 'Healthy Stellar',
      length: 32,
    });

    const verified = speakeasy.totp.verify({
      secret: secret.base32,
      encoding: 'base32',
      token: verificationCode,
      window: 2, // Allow 30 seconds before/after
    });

    if (!verified) {
      throw new BadRequestException('Invalid verification code');
    }

    // Generate 10 backup codes — store only hashes, return plaintext once
    const { plain: backupCodes, hashed: hashedBackupCodes } = await this.generateBackupCodes(10);

    const mfaDevice = this.mfaRepository.create({
      userId,
      secret: secret.base32,
      backupCodes: hashedBackupCodes,
      isVerified: true,
      verifiedAt: new Date(),
      deviceName: deviceName || 'Primary Device',
      isPrimary: true,
    });

    await this.mfaRepository.save(mfaDevice);

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
   * Verify MFA code during login — tries TOTP first, falls back to backup code
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

    const isValid = speakeasy.totp.verify({
      secret: mfaDevice.secret,
      encoding: 'base32',
      token: code,
      window: 2,
    });

    if (isValid) {
      mfaDevice.lastUsedAt = new Date();
      await this.mfaRepository.save(mfaDevice);
      return true;
    }

    return this.verifyBackupCode(mfaDevice, code, userId);
  }

  /**
   * Verify a backup code exclusively — for the dedicated backup-code recovery flow.
   * Returns success flag and remaining code count after consumption.
   */
  async verifyBackupCodeOnly(
    userId: string,
    code: string,
  ): Promise<{ success: boolean; remainingCodes: number }> {
    const mfaDevice = await this.mfaRepository.findOne({
      where: { userId, isActive: true, isPrimary: true },
    });

    if (!mfaDevice) {
      throw new NotFoundException('MFA device not found');
    }

    const success = await this.verifyBackupCode(mfaDevice, code.toUpperCase(), userId);
    return { success, remainingCodes: mfaDevice.backupCodes?.length ?? 0 };
  }

  /**
   * Generate new backup codes — invalidates the previous set
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

    const { plain: newBackupCodes, hashed: hashedNewCodes } = await this.generateBackupCodes(10);
    mfaDevice.backupCodes = hashedNewCodes;
    await this.mfaRepository.save(mfaDevice);

    this.notifyBackupCodesRegenerated(userId).catch((err: any) =>
      this.logger.error(`Backup codes regenerated notification failed: ${err?.message}`),
    );

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

    await this.mfaRepository.update({ userId }, { isActive: false });

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

  /**
   * Compare code against stored hashes. On match: removes the consumed code (single-use)
   * and fires an email security alert. Accepts userId to look up email for the alert.
   */
  private async verifyBackupCode(
    mfaDevice: MfaEntity,
    code: string,
    userId: string,
  ): Promise<boolean> {
    if (!mfaDevice.backupCodes || mfaDevice.backupCodes.length === 0) {
      return false;
    }

    let matchedIndex = -1;
    for (let i = 0; i < mfaDevice.backupCodes.length; i++) {
      if (await argon2.verify(mfaDevice.backupCodes[i], code)) {
        matchedIndex = i;
        break;
      }
    }

    if (matchedIndex === -1) {
      return false;
    }

    // Single-use: remove the consumed code immediately
    mfaDevice.backupCodes = mfaDevice.backupCodes.filter((_, i) => i !== matchedIndex);
    mfaDevice.lastUsedAt = new Date();
    await this.mfaRepository.save(mfaDevice);

    this.notifyBackupCodeConsumed(userId).catch((err: any) =>
      this.logger.error(`Backup code consumed notification failed: ${err?.message}`),
    );

    return true;
  }

  /**
   * Generate backup codes — returns plaintext (shown once to user) and argon2 hashes (stored in DB)
   */
  private async generateBackupCodes(count: number): Promise<{ plain: string[]; hashed: string[] }> {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const plain: string[] = [];

    for (let i = 0; i < count; i++) {
      let code = '';
      for (let j = 0; j < 8; j++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      plain.push(code);
    }

    const hashed = await Promise.all(plain.map((c) => argon2.hash(c)));
    return { plain, hashed };
  }

  private async notifyBackupCodeConsumed(userId: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) return;

    await this.sendEmail(
      user.email,
      'Security Alert: 2FA Backup Code Used',
      `A two-factor authentication backup code was used to access your Healthy Stellar account on ${new Date().toUTCString()}. ` +
        `If you did not initiate this action, please contact support immediately and change your password.`,
    );
  }

  private async notifyBackupCodesRegenerated(userId: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) return;

    await this.sendEmail(
      user.email,
      'Your 2FA Backup Codes Have Been Regenerated',
      `Your Healthy Stellar two-factor authentication backup codes have been regenerated on ${new Date().toUTCString()}. ` +
        `Your previous backup codes are no longer valid. If you did not request this, please contact support immediately.`,
    );
  }

  private async sendEmail(to: string, subject: string, text: string): Promise<void> {
    if (!this.mailerService) {
      this.logger.log(`[Security Email] To: ${to} | Subject: ${subject}`);
      return;
    }
    try {
      await this.mailerService.sendMail({ to, subject, text });
    } catch (err: any) {
      this.logger.error(`Failed to send security email to ${to}: ${err?.message}`);
    }
  }
}
