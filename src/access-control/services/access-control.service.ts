import {
  Injectable,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccessGrant, GrantStatus } from '../entities/access-grant.entity';
import { CreateAccessGrantDto } from '../dto/create-access-grant.dto';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { SorobanQueueService } from './soroban-queue.service';

@Injectable()
export class AccessControlService {
  private readonly logger = new Logger(AccessControlService.name);

  constructor(
    @InjectRepository(AccessGrant)
    private grantRepository: Repository<AccessGrant>,
    private readonly notificationsService: NotificationsService,
    private readonly sorobanQueueService: SorobanQueueService,
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
