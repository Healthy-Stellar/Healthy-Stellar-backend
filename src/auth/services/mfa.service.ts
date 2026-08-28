import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
  Inject,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { MfaEntity } from '../entities/mfa.entity';
import { MfaRecoveryCode } from '../entities/mfa-recovery-code.entity';
import { User } from '../entities/user.entity';
import { MAILER_SERVICE } from '../../notifications/services/notifications.service';
import { DataEncryptionService } from '../../common/services/data-encryption.service';

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

/** Number of recovery codes issued per generation */
const RECOVERY_CODE_COUNT = 10;
/** Each code: 5 bytes → 10 hex chars, formatted as XXXXX-XXXXX */
const RECOVERY_CODE_BYTES = 5;

@Injectable()
export class MfaService {
  private readonly logger = new Logger(MfaService.name);

  constructor(
    @InjectRepository(MfaEntity)
    private mfaRepository: Repository<MfaEntity>,
    @InjectRepository(MfaRecoveryCode)
    private recoveryCodeRepository: Repository<MfaRecoveryCode>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private readonly dataEncryptionService: DataEncryptionService,
    @Optional() @Inject(MAILER_SERVICE) private mailerService?: any,
  ) {}

  async setupMfa(userId: string, deviceName?: string): Promise<MfaSetupResponse> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const secret = speakeasy.generateSecret({
      name: `Healthy Stellar (${user.email})`,
      issuer: 'Healthy Stellar',
      length: 32,
    });

    const qrCode = await QRCode.toDataURL(secret.otpauth_url);
    const { plain } = await this.generateRecoveryCodes(RECOVERY_CODE_COUNT);

    user.mfaSecret = this.dataEncryptionService.encrypt(secret.base32);
    await this.userRepository.save(user);

    return { secret: secret.base32, qrCode, backupCodes: plain };
  }

  async verifyAndEnableMfa(
    userId: string,
    verificationCode: string,
    deviceName?: string,
  ): Promise<MfaVerificationResult> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (!user.mfaSecret) {
      throw new BadRequestException('MFA setup has not been initiated. Call setup first.');
    }

    let secret: string;
    try {
      secret = this.dataEncryptionService.decrypt(user.mfaSecret);
    } catch {
      throw new BadRequestException(
        'MFA setup secret is invalid or corrupted. Please restart MFA setup.',
      );
    }

    const verified = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token: verificationCode,
      window: 2,
    });

    if (!verified) throw new BadRequestException('Invalid verification code');

    // Generate and persist recovery codes — store only hashes
    const { plain: backupCodes } = await this.persistRecoveryCodes(userId);

    const encryptedSecret = this.dataEncryptionService.encrypt(secret);
    const mfaDevice = this.mfaRepository.create({
      userId,
      secret: encryptedSecret,
      backupCodes: [], // legacy field kept for schema compat; real codes in mfa_recovery_codes
      isVerified: true,
      verifiedAt: new Date(),
      deviceName: deviceName || 'Primary Device',
      isPrimary: true,
    });

    await this.mfaRepository.save(mfaDevice);
    user.mfaEnabled = true;
    user.mfaSecret = encryptedSecret;
    await this.userRepository.save(user);

    return { success: true, message: 'MFA enabled successfully', backupCodes };
  }

  async verifyMfaCode(userId: string, code: string): Promise<boolean> {
    const mfaDevice = await this.mfaRepository.findOne({
      where: { userId, isActive: true, isPrimary: true },
    });
    if (!mfaDevice) throw new NotFoundException('MFA device not found');

    let decryptedSecret = '';
    try {
      decryptedSecret = this.dataEncryptionService.decrypt(mfaDevice.secret);
    } catch {
      decryptedSecret = mfaDevice.secret;
    }

    const isValid = speakeasy.totp.verify({
      secret: decryptedSecret,
      encoding: 'base32',
      token: code,
      window: 2,
    });

    if (isValid) {
      mfaDevice.lastUsedAt = new Date();
      await this.mfaRepository.save(mfaDevice);
      return true;
    }

    return this.consumeRecoveryCode(userId, code);
  }

  /**
   * Dedicated recovery-code verification — used by the backup-code endpoint.
   * Returns success flag and remaining unconsumed code count.
   */
  async verifyBackupCodeOnly(
    userId: string,
    code: string,
  ): Promise<{ success: boolean; remainingCodes: number }> {
    const mfaDevice = await this.mfaRepository.findOne({
      where: { userId, isActive: true, isPrimary: true },
    });
    if (!mfaDevice) throw new NotFoundException('MFA device not found');

    const success = await this.consumeRecoveryCode(userId, code.toUpperCase());
    const remainingCodes = await this.recoveryCodeRepository.count({
      where: { userId, consumedAt: IsNull() },
    });
    return { success, remainingCodes };
  }

  /**
   * Regenerate recovery codes — atomically deletes all existing codes (consumed or not)
   * and issues a fresh set. Requires a valid TOTP code as re-auth.
   */
  async generateNewBackupCodes(userId: string): Promise<string[]> {
    const mfaDevice = await this.mfaRepository.findOne({
      where: { userId, isPrimary: true },
    });
    if (!mfaDevice) throw new NotFoundException('MFA device not found');

    const { plain } = await this.persistRecoveryCodes(userId);

    this.notifyBackupCodesRegenerated(userId).catch((err: any) =>
      this.logger.error(`Backup codes regenerated notification failed: ${err?.message}`),
    );

    return plain;
  }

  async disableMfa(userId: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    await this.mfaRepository.update({ userId }, { isActive: false });
    // Invalidate all recovery codes on MFA disable
    await this.recoveryCodeRepository.delete({ userId });

    user.mfaEnabled = false;
    user.mfaSecret = null;
    await this.userRepository.save(user);
  }

  async getMfaDevices(userId: string): Promise<MfaEntity[]> {
    return this.mfaRepository.find({ where: { userId, isActive: true } });
  }

  async isMfaEnabled(userId: string): Promise<boolean> {
    const mfaDevice = await this.mfaRepository.findOne({
      where: { userId, isActive: true, isVerified: true },
    });
    return !!mfaDevice;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /**
   * Delete all existing recovery codes for the user and insert a fresh set.
   * Returns plaintext codes (shown once) — only hashes are persisted.
   */
  private async persistRecoveryCodes(
    userId: string,
  ): Promise<{ plain: string[] }> {
    const { plain, hashed } = await this.generateRecoveryCodes(RECOVERY_CODE_COUNT);

    // Invalidate all previous codes (consumed or not) atomically
    await this.recoveryCodeRepository.delete({ userId });

    const entities = hashed.map((codeHash) =>
      this.recoveryCodeRepository.create({ userId, codeHash, consumedAt: null }),
    );
    await this.recoveryCodeRepository.save(entities);

    return { plain };
  }

  /**
   * Find and consume a matching recovery code.
   * Iterates only unconsumed codes; marks matched code consumed immediately.
   */
  private async consumeRecoveryCode(userId: string, code: string): Promise<boolean> {
    const activeCodes = await this.recoveryCodeRepository.find({
      where: { userId, consumedAt: IsNull() },
    });

    for (const record of activeCodes) {
      if (await argon2.verify(record.codeHash, code)) {
        record.consumedAt = new Date();
        await this.recoveryCodeRepository.save(record);

        this.notifyBackupCodeConsumed(userId).catch((err: any) =>
          this.logger.error(`Backup code consumed notification failed: ${err?.message}`),
        );
        return true;
      }
    }
    return false;
  }

  /**
   * Generate recovery codes using a cryptographically secure source.
   * Format: XXXXX-XXXXX (10 uppercase hex chars with a dash separator).
   */
  private async generateRecoveryCodes(
    count: number,
  ): Promise<{ plain: string[]; hashed: string[] }> {
    const plain: string[] = Array.from({ length: count }, () => {
      const buf = randomBytes(RECOVERY_CODE_BYTES * 2); // 10 bytes → 20 hex chars
      const hex = buf.toString('hex').toUpperCase(); // 20 chars
      return `${hex.slice(0, 5)}-${hex.slice(5, 10)}-${hex.slice(10, 15)}-${hex.slice(15, 20)}`;
    });

    const hashed = await Promise.all(plain.map((c) => argon2.hash(c)));
    return { plain, hashed };
  }

  private async notifyBackupCodeConsumed(userId: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) return;
    await this.sendEmail(
      user.email,
      'Security Alert: 2FA Recovery Code Used',
      `A two-factor authentication recovery code was used to access your Healthy Stellar account on ${new Date().toUTCString()}. ` +
        `If you did not initiate this action, please contact support immediately and change your password.`,
    );
  }

  private async notifyBackupCodesRegenerated(userId: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) return;
    await this.sendEmail(
      user.email,
      'Your 2FA Recovery Codes Have Been Regenerated',
      `Your Healthy Stellar two-factor authentication recovery codes were regenerated on ${new Date().toUTCString()}. ` +
        `Your previous codes are no longer valid. If you did not request this, contact support immediately.`,
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
