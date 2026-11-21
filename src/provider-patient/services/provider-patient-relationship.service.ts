import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ProviderPatientRelationship,
  ProviderPatientRelationshipStatus,
} from '../entities/provider-patient-relationship.entity';
import { AuditLogService } from '../../audit-log/audit-log.service';

@Injectable()
export class ProviderPatientRelationshipService {
  constructor(
    @InjectRepository(ProviderPatientRelationship)
    private readonly relationshipRepository: Repository<ProviderPatientRelationship>,
    private readonly auditLogService: AuditLogService,
  ) {}

  async upsertRelationship(
    providerAddress: string,
    patientAddress: string,
  ): Promise<ProviderPatientRelationship> {
    const existing = await this.relationshipRepository.findOne({
      where: { providerAddress, patientAddress },
    });

    if (existing) {
      existing.recordCount += 1;
      existing.status = ProviderPatientRelationshipStatus.ACTIVE;
      existing.terminatedAt = null;
      return this.relationshipRepository.save(existing);
    }

    const relationship = this.relationshipRepository.create({
      providerAddress,
      patientAddress,
      recordCount: 1,
      status: ProviderPatientRelationshipStatus.ACTIVE,
      terminatedAt: null,
    });

    return this.relationshipRepository.save(relationship);
  }

  async terminateRelationship(
    providerAddress: string,
    patientAddress: string,
    actorAddress?: string,
  ): Promise<ProviderPatientRelationship> {
    const relationship = await this.relationshipRepository.findOne({
      where: { providerAddress, patientAddress },
    });

    if (!relationship) {
      throw new NotFoundException('Provider-patient relationship not found');
    }

    relationship.status = ProviderPatientRelationshipStatus.TERMINATED;
    relationship.terminatedAt = new Date();
    const saved = await this.relationshipRepository.save(relationship);

    await this.auditLogService.log({
      action: 'provider-patient-relationship.terminated',
      actorAddress: actorAddress ?? providerAddress,
      resourceType: 'ProviderPatientRelationship',
      resourceId: saved.id,
      metadata: { providerAddress, patientAddress },
    });

    return saved;
  }

  async getPatientsByProvider(
    providerAddress: string,
    includeTerminated = false,
  ): Promise<ProviderPatientRelationship[]> {
    return this.relationshipRepository.find({
      where: includeTerminated
        ? { providerAddress }
        : { providerAddress, status: ProviderPatientRelationshipStatus.ACTIVE },
    });
  }

  async getProvidersByPatient(
    patientAddress: string,
    includeTerminated = false,
  ): Promise<ProviderPatientRelationship[]> {
    return this.relationshipRepository.find({
      where: includeTerminated
        ? { patientAddress }
        : { patientAddress, status: ProviderPatientRelationshipStatus.ACTIVE },
    });
  }
}
