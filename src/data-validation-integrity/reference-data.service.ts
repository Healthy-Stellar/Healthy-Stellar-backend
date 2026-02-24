import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  MedicalCodeRegistry,
  ReferenceDataUpdateLog,
} from '../entities/medical-validation.entities';
import { ReferenceDataUpdate } from '../interfaces/validation-result.interface';

interface CodeImportItem {
  code: string;
  description: string;
  category?: string;
  isActive: boolean;
  version?: string;
  effectiveDate?: Date;
  expiryDate?: Date;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class ReferenceDataService {
  private readonly logger = new Logger(ReferenceDataService.name);

  constructor(
    @InjectRepository(MedicalCodeRegistry)
    private readonly codeRegistryRepo: Repository<MedicalCodeRegistry>,
    @InjectRepository(ReferenceDataUpdateLog)
    private readonly updateLogRepo: Repository<ReferenceDataUpdateLog>,
  ) {}

  /**
   * Import or update codes for a given coding system
   */
  async importCodes(
    codeSystem: string,
    version: string,
    codes: CodeImportItem[],
    updatedBy: string = 'SYSTEM',
  ): Promise<ReferenceDataUpdate> {
    this.logger.log(`Starting ${codeSystem} import: ${codes.length} codes (v${version})`);

    let addedCodes = 0;
    let updatedCodes = 0;
    let deprecatedCodes = 0;

    // Get existing codes for this system
    const existingCodes = await this.codeRegistryRepo.find({
      where: { codeSystem },
      select: ['id', 'code', 'isActive', 'description'],
    });

    const existingMap = new Map(existingCodes.map((c) => [c.code, c]));
    const incomingCodes = new Set(codes.map((c) => c.code));

    // Deprecate codes not in the new set
    for (const existing of existingCodes) {
      if (!incomingCodes.has(existing.code) && existing.isActive) {
        await this.codeRegistryRepo.update(existing.id, {
          isActive: false,
          expiryDate: new Date(),
        });
        deprecatedCodes++;
      }
    }

    // Upsert incoming codes in batches
    const batchSize = 500;
    for (let i = 0; i < codes.length; i += batchSize) {
      const batch = codes.slice(i, i + batchSize);

      for (const codeItem of batch) {
        const existing = existingMap.get(codeItem.code);

        if (!existing) {
          // New code
          await this.codeRegistryRepo.save({
            codeSystem,
            code: codeItem.code,
            description: codeItem.description,
            category: codeItem.category,
            isActive: codeItem.isActive,
            version,
            effectiveDate: codeItem.effectiveDate,
            expiryDate: codeItem.expiryDate,
            metadata: codeItem.metadata,
          });
          addedCodes++;
        } else if (
          existing.description !== codeItem.description ||
          existing.isActive !== codeItem.isActive
        ) {
          // Updated code
          await this.codeRegistryRepo.update(existing.id, {
            description: codeItem.description,
            isActive: codeItem.isActive,
            version,
            expiryDate: codeItem.expiryDate,
          });
          updatedCodes++;
        }
      }
    }

    // Log the update
    const updateLog = await this.updateLogRepo.save({
      codeSystem,
      version,
      totalCodes: codes.length,
      addedCodes,
      updatedCodes,
      deprecatedCodes,
      updatedBy,
      updateSummary: {
        importedAt: new Date().toISOString(),
        batchCount: Math.ceil(codes.length / batchSize),
      },
    });

    this.logger.log(
      `${codeSystem} import complete: +${addedCodes} added, ~${updatedCodes} updated, -${deprecatedCodes} deprecated`,
    );

    return {
      codeSystem,
      version,
      totalCodes: codes.length,
      addedCodes,
      updatedCodes,
      deprecatedCodes,
      updatedAt: updateLog.updatedAt,
    };
  }

  /**
   * Get current code statistics per system
   */
  async getCodeSystemStats(): Promise<
    Record<string, { total: number; active: number; deprecated: number; lastUpdated: Date | null }>
  > {
    const systems = ['ICD-10', 'CPT', 'LOINC', 'NDC', 'SNOMED'];
    const stats: Record<string, any> = {};

    for (const system of systems) {
      const [total, active] = await Promise.all([
        this.codeRegistryRepo.count({ where: { codeSystem: system } }),
        this.codeRegistryRepo.count({ where: { codeSystem: system, isActive: true } }),
      ]);

      const lastUpdate = await this.updateLogRepo.findOne({
        where: { codeSystem: system },
        order: { updatedAt: 'DESC' },
      });

      stats[system] = {
        total,
        active,
        deprecated: total - active,
        lastUpdated: lastUpdate?.updatedAt || null,
      };
    }

    return stats;
  }

  /**
   * Search for codes across systems
   */
  async searchCodes(
    query: string,
    codeSystem?: string,
    activeOnly: boolean = true,
    limit: number = 20,
  ): Promise<MedicalCodeRegistry[]> {
    const qb = this.codeRegistryRepo
      .createQueryBuilder('registry')
      .where('(registry.code ILIKE :query OR registry.description ILIKE :queryDesc)', {
        query: `${query}%`,
        queryDesc: `%${query}%`,
      })
      .orderBy('registry.code', 'ASC')
      .take(limit);

    if (codeSystem) {
      qb.andWhere('registry.codeSystem = :codeSystem', { codeSystem });
    }

    if (activeOnly) {
      qb.andWhere('registry.isActive = true');
    }

    return qb.getMany();
  }

  /**
   * Get update history for a code system
   */
  async getUpdateHistory(
    codeSystem?: string,
    limit: number = 10,
  ): Promise<ReferenceDataUpdateLog[]> {
    const query = this.updateLogRepo
      .createQueryBuilder('log')
      .orderBy('log.updatedAt', 'DESC')
      .take(limit);

    if (codeSystem) {
      query.where('log.codeSystem = :codeSystem', { codeSystem });
    }

    return query.getMany();
  }

  /**
   * Validate that codes exist in registry (bulk check)
   */
  async bulkExistenceCheck(
    codeSystem: string,
    codes: string[],
  ): Promise<{ found: string[]; notFound: string[]; deprecated: string[] }> {
    const records = await this.codeRegistryRepo.find({
      where: { codeSystem, code: In(codes) },
      select: ['code', 'isActive'],
    });

    const foundMap = new Map(records.map((r) => [r.code, r.isActive]));

    return {
      found: codes.filter((c) => foundMap.has(c) && foundMap.get(c) === true),
      deprecated: codes.filter((c) => foundMap.has(c) && foundMap.get(c) === false),
      notFound: codes.filter((c) => !foundMap.has(c)),
    };
  }

  /**
   * Scheduled task - check for stale reference data and log warnings
   */
  @Cron(CronExpression.EVERY_WEEK)
  async checkReferenceDataFreshness(): Promise<void> {
    this.logger.log('Running reference data freshness check...');

    const stats = await this.getCodeSystemStats();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    for (const [system, stat] of Object.entries(stats)) {
      if (!stat.lastUpdated || new Date(stat.lastUpdated) < sixMonthsAgo) {
        this.logger.warn(
          `Reference data for ${system} may be stale. Last updated: ${stat.lastUpdated || 'never'}`,
        );
      } else {
        this.logger.log(`${system}: ${stat.active} active codes, last updated ${stat.lastUpdated}`);
      }
    }
  }
}
