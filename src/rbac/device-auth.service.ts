import { Injectable, Logger, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { MedicalDevice, DeviceStatus, DeviceTrustLevel } from '../entities/medical-device.entity';
import { EncryptionService } from '../encryption/encryption.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction, AuditSeverity } from '../entities/audit-log.entity';

export interface DeviceAuthChallenge {
  challenge: string;
  expiresAt: Date;
  deviceId: string;
}

export interface DeviceAuthResult {
  authenticated: boolean;
  device: MedicalDevice;
  sessionToken: string;
  expiresAt: Date;
}

export interface RegisterDeviceDto {
  name: string;
  type: MedicalDevice['type'];
  deviceSerialNumber: string;
  manufacturer?: string;
  model?: string;
  firmwareVersion?: string;
  location?: string;
  department?: string;
  publicKey?: string;
  allowedIpRanges?: string[];
  allowedCapabilities?: string[];
  registeredBy: string;
}

@Injectable()
export class DeviceAuthService {
  private readonly logger = new Logger(DeviceAuthService.name);
  private readonly MAX_FAILED_ATTEMPTS = 5;
  private readonly LOCKOUT_MINUTES = 30;
  private readonly SESSION_HOURS = 8;
  private readonly challengeStore = new Map<string, { challenge: string; expiresAt: Date }>();

  constructor(
    @InjectRepository(MedicalDevice)
    private readonly deviceRepository: Repository<MedicalDevice>,
    private readonly encryptionService: EncryptionService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Register a new medical device with certificate pinning
   */
  async registerDevice(dto: RegisterDeviceDto): Promise<MedicalDevice> {
    const apiKey = this.encryptionService.generateSecureToken(32);
    const apiKeyHash = this.encryptionService.hashIdentifier(apiKey, 'device-api-key-salt');

    const device = this.deviceRepository.create({
      ...dto,
      status: DeviceStatus.INACTIVE,
      trustLevel: DeviceTrustLevel.LOW,
      apiKeyHash,
      failedAuthAttempts: 0,
    });

    const saved = await this.deviceRepository.save(device);

    await this.auditService.log({
      action: AuditAction.DEVICE_REGISTERED,
      severity: AuditSeverity.INFO,
      resource: 'MedicalDevice',
      resourceId: saved.id,
      userId: dto.registeredBy,
      metadata: { deviceType: dto.type, serialNumber: dto.deviceSerialNumber },
    });

    this.logger.log(`Medical device registered: ${saved.id} (${saved.type})`);

    // Return API key only once during registration
    return { ...saved, apiKeyHash: apiKey } as MedicalDevice;
  }

  /**
   * Authenticate device via API key
   */
  async authenticateByApiKey(
    deviceId: string,
    apiKey: string,
    ipAddress: string,
  ): Promise<DeviceAuthResult> {
    const device = await this.deviceRepository.findOne({ where: { id: deviceId } });

    if (!device) {
      throw new UnauthorizedException('Device not found');
    }

    await this.checkDeviceEligibility(device);

    const providedHash = this.encryptionService.hashIdentifier(apiKey, 'device-api-key-salt');
    const isValid = crypto.timingSafeEqual(
      Buffer.from(providedHash),
      Buffer.from(device.apiKeyHash || ''),
    );

    if (!isValid) {
      await this.recordFailedAttempt(device, ipAddress);
      throw new UnauthorizedException('Invalid device credentials');
    }

    return this.createDeviceSession(device, ipAddress, 'API_KEY');
  }

  /**
   * Challenge-response authentication for high-security devices
   */
  async generateChallenge(deviceId: string): Promise<DeviceAuthChallenge> {
    const device = await this.deviceRepository.findOneOrFail({ where: { id: deviceId } });
    await this.checkDeviceEligibility(device);

    const challenge = this.encryptionService.generateSecureToken(32);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    this.challengeStore.set(deviceId, { challenge, expiresAt });

    return { challenge, expiresAt, deviceId };
  }

  /**
   * Verify challenge response signed with device private key
   */
  async verifyChallenge(
    deviceId: string,
    signedChallenge: string,
    ipAddress: string,
  ): Promise<DeviceAuthResult> {
    const device = await this.deviceRepository.findOneOrFail({ where: { id: deviceId } });
    await this.checkDeviceEligibility(device);

    const stored = this.challengeStore.get(deviceId);
    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Challenge expired or not found');
    }

    if (!device.publicKey) {
      throw new ForbiddenException('Device has no public key configured');
    }

    try {
      const verify = crypto.createVerify('SHA256');
      verify.update(stored.challenge);
      const isValid = verify.verify(device.publicKey, signedChallenge, 'base64');

      if (!isValid) {
        await this.recordFailedAttempt(device, ipAddress);
        throw new UnauthorizedException('Invalid signature');
      }
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      await this.recordFailedAttempt(device, ipAddress);
      throw new UnauthorizedException('Signature verification failed');
    }

    this.challengeStore.delete(deviceId);
    return this.createDeviceSession(device, ipAddress, 'CHALLENGE_RESPONSE');
  }

  /**
   * Update device trust level after security assessment
   */
  async updateTrustLevel(
    deviceId: string,
    trustLevel: DeviceTrustLevel,
    updatedBy: string,
  ): Promise<MedicalDevice> {
    const device = await this.deviceRepository.findOneOrFail({ where: { id: deviceId } });
    device.trustLevel = trustLevel;

    if (trustLevel === DeviceTrustLevel.HIGH || trustLevel === DeviceTrustLevel.CRITICAL) {
      device.status = DeviceStatus.ACTIVE;
    }

    const updated = await this.deviceRepository.save(device);

    await this.auditService.log({
      action: AuditAction.DEVICE_AUTHENTICATED,
      severity: AuditSeverity.INFO,
      resource: 'MedicalDevice',
      resourceId: deviceId,
      userId: updatedBy,
      metadata: { trustLevel },
    });

    return updated;
  }

  /**
   * Revoke device access
   */
  async revokeDevice(deviceId: string, revokedBy: string, reason: string): Promise<void> {
    await this.deviceRepository.update(deviceId, {
      status: DeviceStatus.SUSPENDED,
    });

    await this.auditService.log({
      action: AuditAction.DEVICE_REVOKED,
      severity: AuditSeverity.WARNING,
      resource: 'MedicalDevice',
      resourceId: deviceId,
      userId: revokedBy,
      metadata: { reason },
    });
  }

  private async checkDeviceEligibility(device: MedicalDevice): Promise<void> {
    if (device.status === DeviceStatus.DECOMMISSIONED) {
      throw new ForbiddenException('Device is decommissioned');
    }

    if (device.status === DeviceStatus.SUSPENDED) {
      if (device.suspendedUntil && device.suspendedUntil > new Date()) {
        throw new ForbiddenException(
          `Device suspended until ${device.suspendedUntil.toISOString()}`,
        );
      }
      // Auto-unsuspend if past suspension period
      await this.deviceRepository.update(device.id, {
        status: DeviceStatus.ACTIVE,
        failedAuthAttempts: 0,
        suspendedUntil: null,
      });
    }

    if (device.certExpiresAt && device.certExpiresAt < new Date()) {
      throw new ForbiddenException('Device certificate has expired');
    }
  }

  private async recordFailedAttempt(device: MedicalDevice, ipAddress: string): Promise<void> {
    const attempts = device.failedAuthAttempts + 1;

    const update: Partial<MedicalDevice> = {
      failedAuthAttempts: attempts,
      lastSeenAt: new Date(),
      lastKnownIpAddress: ipAddress,
    };

    if (attempts >= this.MAX_FAILED_ATTEMPTS) {
      update.status = DeviceStatus.SUSPENDED;
      update.suspendedUntil = new Date(Date.now() + this.LOCKOUT_MINUTES * 60 * 1000);
      this.logger.warn(`Device ${device.id} suspended after ${attempts} failed attempts`);
    }

    await this.deviceRepository.update(device.id, update);

    await this.auditService.log({
      action: AuditAction.DEVICE_REJECTED,
      severity:
        attempts >= this.MAX_FAILED_ATTEMPTS ? AuditSeverity.CRITICAL : AuditSeverity.WARNING,
      resource: 'MedicalDevice',
      resourceId: device.id,
      ipAddress,
      metadata: { failedAttempts: attempts, suspended: attempts >= this.MAX_FAILED_ATTEMPTS },
    });
  }

  private async createDeviceSession(
    device: MedicalDevice,
    ipAddress: string,
    authMethod: string,
  ): Promise<DeviceAuthResult> {
    const sessionToken = this.encryptionService.generateSecureToken(48);
    const expiresAt = new Date(Date.now() + this.SESSION_HOURS * 60 * 60 * 1000);

    await this.deviceRepository.update(device.id, {
      failedAuthAttempts: 0,
      lastSeenAt: new Date(),
      lastKnownIpAddress: ipAddress,
      status: DeviceStatus.ACTIVE,
    });

    await this.auditService.log({
      action: AuditAction.DEVICE_AUTHENTICATED,
      severity: AuditSeverity.INFO,
      resource: 'MedicalDevice',
      resourceId: device.id,
      ipAddress,
      deviceId: device.id,
      metadata: { authMethod, trustLevel: device.trustLevel },
    });

    return {
      authenticated: true,
      device,
      sessionToken,
      expiresAt,
    };
  }
}
