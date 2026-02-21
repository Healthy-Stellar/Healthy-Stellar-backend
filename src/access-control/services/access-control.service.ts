import { Injectable, ConflictException, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccessGrant, GrantStatus } from '../entities/access-grant.entity';
import { CreateAccessGrantDto } from '../dto/create-access-grant.dto';

@Injectable()
export class AccessControlService {
  private readonly logger = new Logger(AccessControlService.name);

  constructor(
    @InjectRepository(AccessGrant)
    private grantRepository: Repository<AccessGrant>,
  ) {}

  async grantAccess(patientId: string, dto: CreateAccessGrantDto): Promise<AccessGrant> {
    // Check for duplicate active grant
    for (const recordId of dto.recordIds) {
      const existing = await this.grantRepository.findOne({
        where: {
          patientId,
          granteeId: dto.granteeId,
          recordIds: recordId as any,
          status: GrantStatus.ACTIVE,
        },
      });

      if (existing) {
        throw new ConflictException(
          `Active grant already exists for patient ${patientId}, grantee ${dto.granteeId}, and record ${recordId}`
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
    
    // TODO: Dispatch Soroban tx via BullMQ
    this.logger.log(`Access granted: ${saved.id} for patient ${patientId}`);
    
    return saved;
  }

  async revokeAccess(grantId: string, patientId: string, reason?: string): Promise<AccessGrant> {
    const grant = await this.grantRepository.findOne({
      where: { id: grantId, patientId },
    });

    if (!grant) {
      throw new NotFoundException(`Grant ${grantId} not found`);
    }

    grant.status = GrantStatus.REVOKED;
    grant.revokedAt = new Date();
    grant.revokedBy = patientId;
    grant.revocationReason = reason;

    const saved = await this.grantRepository.save(grant);
    
    // TODO: Dispatch revocation tx via BullMQ
    this.logger.log(`Access revoked: ${grantId} by patient ${patientId}`);
    
    return saved;
  }

  async getPatientGrants(patientId: string): Promise<AccessGrant[]> {
    return this.grantRepository.find({
      where: { patientId, status: GrantStatus.ACTIVE },
      order: { createdAt: 'DESC' },
    });
  }

  async getReceivedGrants(granteeId: string): Promise<AccessGrant[]> {
    return this.grantRepository.find({
      where: { granteeId, status: GrantStatus.ACTIVE },
      order: { createdAt: 'DESC' },
    });
  }
}
