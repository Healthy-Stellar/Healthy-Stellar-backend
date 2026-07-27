import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ProviderPatientRelationship } from '../entities/provider-patient-relationship.entity';
import { RelationshipQueryDto } from '../dto/relationship-query.dto';

export interface PaginatedRelationships {
  data: ProviderPatientRelationship[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class ProviderPatientRelationshipService {
  constructor(
    @InjectRepository(ProviderPatientRelationship)
    private readonly repo: Repository<ProviderPatientRelationship>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Atomically upsert a provider-patient relationship.
   * Called inside the same transaction as record creation.
   */
  async upsertRelationship(providerId: string, patientId: string): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO provider_patient_relationships
         ("providerId", "patientId", "firstInteractionAt", "recordCount")
       VALUES ($1, $2, NOW(), 1)
       ON CONFLICT ("providerId", "patientId")
       DO UPDATE SET
         "recordCount" = provider_patient_relationships."recordCount" + 1`,
      [providerId, patientId],
    );
  }

  async getPatientsByProvider(
    providerId: string,
    query: RelationshipQueryDto,
  ): Promise<PaginatedRelationships> {
    const { page = 1, limit = 20 } = query;
    const [data, total] = await this.repo.findAndCount({
      where: { providerId },
      order: { firstInteractionAt: 'DESC' },
      take: limit,
      skip: (page - 1) * limit,
    });
    return { data, total, page, limit };
  }

  async getProvidersByPatient(
    patientId: string,
    query: RelationshipQueryDto,
  ): Promise<PaginatedRelationships> {
    const { page = 1, limit = 20 } = query;
    const [data, total] = await this.repo.findAndCount({
      where: { patientId },
      order: { firstInteractionAt: 'DESC' },
      take: limit,
      skip: (page - 1) * limit,
    });
    return { data, total, page, limit };
  }
}
