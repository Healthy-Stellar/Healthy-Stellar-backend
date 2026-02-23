import {
  Injectable,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { AccessGrant, AccessLevel, GrantStatus } from '../entities/access-grant.entity';
import { CreateAccessGrantDto } from '../dto/create-access-grant.dto';
import { CreateEmergencyAccessDto } from '../dto/create-emergency-access.dto';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { SorobanQueueService } from './soroban-queue.service';
import { User } from '../../auth/entities/user.entity';
import { AuditLogService } from '../../common/services/audit-log.service';

@Injectable()
export class AccessControlService {
  private readonly logger = new Logger(AccessControlService.name);

  constructor(
    @InjectRepository(AccessGrant)
    private grantRepository: Repository<AccessGrant>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private readonly notificationsService: NotificationsService,
    private readonly sorobanQueueService: SorobanQueueService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async grantAccess(patientId: string, dto: CreateAccessGrantDto): Promise<AccessGrant> {
    const grantInputs = await this.findRelevantActiveGrants(patientId, dto.granteeId);

    for (const grant of grantInputs) {
      const hasMatchingRecord = grant.recordIds.some((recordId) => dto.recordIds.includes(recordId));
      if (hasMatchingRecord) {
        throw new ConflictException(
          `Active grant already exists for patient ${patientId}, grantee ${dto.granteeId}, and record overlap`,
        );
      }
    }

    const grant = this.grantRepository.create({
      patientId,
      granteeId: dto.granteeId,
      recordIds: dto.recordIds,
      accessLevel: dto.accessLevel,
      isEmergency: false,
      emergencyReason: null,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      status: GrantStatus.ACTIVE,
    });

    const saved = await this.grantRepository.save(grant);

    const sorobanTxHash = await this.sorobanQueueService.dispatchGrant(saved);
    saved.sorobanTxHash = sorobanTxHash;

    const updated = await this.grantRepository.save(saved);

    this.notificationsService.emitAccessGranted(patientId, updated.id, {
      patientId,
      granteeId: updated.granteeId,
      grantId: updated.id,
      recordIds: updated.recordIds,
      accessLevel: updated.accessLevel,
      sorobanTxHash: updated.sorobanTxHash,
    });

    this.logger.log(`Access granted: ${updated.id} for patient ${patientId}`);

    return updated;
  }

  async revokeAccess(grantId: string, patientId: string, reason?: string): Promise<AccessGrant> {
    const grant = await this.grantRepository.findOne({
      where: { id: grantId, patientId },
    });

    if (!grant || grant.status === GrantStatus.REVOKED) {
      throw new NotFoundException(`Grant ${grantId} not found`);
    }

    grant.status = GrantStatus.REVOKED;
    grant.revokedAt = new Date();
    grant.revokedBy = patientId;
    grant.revocationReason = reason;

    const saved = await this.grantRepository.save(grant);

    const sorobanTxHash = await this.sorobanQueueService.dispatchRevoke(saved);
    saved.sorobanTxHash = sorobanTxHash;

    const finalGrant = await this.grantRepository.save(saved);

    this.notificationsService.emitAccessRevoked(patientId, finalGrant.id, {
      patientId,
      granteeId: finalGrant.granteeId,
      grantId: finalGrant.id,
      revocationReason: finalGrant.revocationReason,
      sorobanTxHash: finalGrant.sorobanTxHash,
    });

    this.logger.log(`Access revoked: ${grantId} by patient ${patientId}`);

    return finalGrant;
  }

  async createEmergencyAccess(requestedBy: string, dto: CreateEmergencyAccessDto): Promise<AccessGrant> {
    if (!dto.emergencyReason || dto.emergencyReason.trim().length < 50) {
      throw new BadRequestException('emergencyReason must be at least 50 characters');
    }

    const patient = await this.userRepository.findOne({ where: { id: dto.patientId } });
    if (!patient) {
      throw new NotFoundException(`Patient ${dto.patientId} not found`);
    }

    if (patient.emergencyAccessEnabled === false) {
      throw new ForbiddenException('Emergency access is disabled for this patient');
    }

    const existing = await this.grantRepository.findOne({
      where: {
        patientId: dto.patientId,
        granteeId: requestedBy,
        isEmergency: true,
        status: GrantStatus.ACTIVE,
      },
      order: { createdAt: 'DESC' },
    });

    const now = new Date();
    if (existing && (!existing.expiresAt || existing.expiresAt > now)) {
      throw new ConflictException('An active emergency access grant already exists');
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const grant = this.grantRepository.create({
      patientId: dto.patientId,
      granteeId: requestedBy,
      recordIds: ['*'],
      accessLevel: AccessLevel.READ_WRITE,
      isEmergency: true,
      emergencyReason: dto.emergencyReason.trim(),
      expiresAt,
      status: GrantStatus.ACTIVE,
    });

    const saved = await this.grantRepository.save(grant);

    await this.notificationsService.sendPatientEmailNotification(
      dto.patientId,
      'Emergency Access Notice',
      'Your records were accessed under emergency override.',
    );

    this.notificationsService.emitEmergencyAccess(requestedBy, dto.patientId, {
      targetUserId: dto.patientId,
      grantId: saved.id,
      by: requestedBy,
      expiresAt: saved.expiresAt,
    });

    await this.auditLogService.create({
      operation: 'EMERGENCY_ACCESS',
      entityType: 'access_grants',
      entityId: saved.id,
      userId: requestedBy,
      status: 'success',
      newValues: {
        patientId: dto.patientId,
        granteeId: requestedBy,
        isEmergency: true,
        expiresAt: saved.expiresAt,
      },
      changes: {
        emergencyReason: dto.emergencyReason.trim(),
      },
    });

    this.logger.warn(`Emergency access granted: ${saved.id} for patient ${dto.patientId} by ${requestedBy}`);
    return saved;
  }

  async getEmergencyLog(patientId: string): Promise<AccessGrant[]> {
    return this.grantRepository.find({
      where: {
        patientId,
        isEmergency: true,
      },
      order: { createdAt: 'DESC' },
    });
  }

  async setEmergencyAccessEnabled(
    targetUserId: string,
    enabled: boolean,
    actorUserId: string,
  ): Promise<{ success: true }> {
    const user = await this.userRepository.findOne({ where: { id: targetUserId } });
    if (!user) {
      throw new NotFoundException(`User ${targetUserId} not found`);
    }

    user.emergencyAccessEnabled = enabled;
    await this.userRepository.save(user);

    await this.auditLogService.create({
      operation: 'EMERGENCY_ACCESS_TOGGLE',
      entityType: 'users',
      entityId: targetUserId,
      userId: actorUserId,
      status: 'success',
      changes: {
        emergencyAccessEnabled: enabled,
      },
    });

    return { success: true };
  }

  async findActiveEmergencyGrant(
    patientId: string,
    granteeId: string,
    recordId?: string,
  ): Promise<AccessGrant | null> {
    const grant = await this.grantRepository.findOne({
      where: {
        patientId,
        granteeId,
        status: GrantStatus.ACTIVE,
        isEmergency: true,
      },
      order: { createdAt: 'DESC' },
    });

    if (!grant) {
      return null;
    }

    const now = new Date();
    if (grant.expiresAt && grant.expiresAt <= now) {
      grant.status = GrantStatus.EXPIRED;
      await this.grantRepository.save(grant);
      return null;
    }

    if (recordId && !(grant.recordIds.includes('*') || grant.recordIds.includes(recordId))) {
      return null;
    }

    return grant;
  }

  async expireEmergencyGrants(): Promise<number> {
    const result = await this.grantRepository.update(
      {
        isEmergency: true,
        status: GrantStatus.ACTIVE,
        expiresAt: LessThanOrEqual(new Date()),
      },
      {
        status: GrantStatus.EXPIRED,
      },
    );

    const expired = result.affected || 0;
    if (expired > 0) {
      this.logger.log(`Expired ${expired} emergency access grants`);
    }
    return expired;
  }

  async getPatientGrants(patientId: string): Promise<AccessGrant[]> {
    const grants = await this.grantRepository.find({
      where: { patientId, status: GrantStatus.ACTIVE },
      order: { createdAt: 'DESC' },
    });

    const now = new Date();
    const activeGrants = grants.filter((grant) => !grant.expiresAt || grant.expiresAt > now);

    for (const grant of grants) {
      if (grant.expiresAt && grant.expiresAt <= now && grant.status !== GrantStatus.EXPIRED) {
        await this.grantRepository.update(grant.id, { status: GrantStatus.EXPIRED });
      }
    }

    return activeGrants;
  }

  async getReceivedGrants(granteeId: string): Promise<AccessGrant[]> {
    const grants = await this.grantRepository.find({
      where: { granteeId, status: GrantStatus.ACTIVE },
      order: { createdAt: 'DESC' },
    });

    const now = new Date();
    const activeGrants = grants.filter((grant) => !grant.expiresAt || grant.expiresAt > now);

    for (const grant of grants) {
      if (grant.expiresAt && grant.expiresAt <= now && grant.status !== GrantStatus.EXPIRED) {
        await this.grantRepository.update(grant.id, { status: GrantStatus.EXPIRED });
      }
    }

    return activeGrants;
  }

  private async findRelevantActiveGrants(patientId: string, granteeId: string): Promise<AccessGrant[]> {
    return this.grantRepository.find({
      where: {
        patientId,
        granteeId,
        status: GrantStatus.ACTIVE,
      },
      order: { createdAt: 'DESC' },
    });
  }
}
