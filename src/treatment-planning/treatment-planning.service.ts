import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { TreatmentPlan } from './entities/treatment-plan.entity';
import { TreatmentPlanVersion } from './entities/treatment-plan-version.entity';
import { EventStoreService } from '../event-store/event-store.service';
import * as jsondiffpatch from 'jsondiffpatch';

@Injectable()
export class TreatmentPlanningService {
  private differ = jsondiffpatch.create();

  constructor(
    @InjectRepository(TreatmentPlan)
    private readonly planRepo: Repository<TreatmentPlan>,
    @InjectRepository(TreatmentPlanVersion)
    private readonly versionRepo: Repository<TreatmentPlanVersion>,
    private readonly eventStore: EventStoreService,
    private readonly dataSource: DataSource,
  ) {}

  async savePlan(planId: string, updateData: any, authorId: string): Promise<TreatmentPlan> {
    return this.dataSource.transaction(async (manager) => {
      const plan = await manager.findOne(TreatmentPlan, {
        where: { id: planId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!plan) throw new NotFoundException('Treatment Plan not found');

      Object.assign(plan, updateData);
      const updatedPlan = await manager.save(TreatmentPlan, plan);

      const latestVersion = await manager.findOne(TreatmentPlanVersion, {
        where: { treatmentPlanId: planId },
        order: { versionNumber: 'DESC' },
        lock: { mode: 'pessimistic_write' },
      });
      const nextVersionNum = latestVersion ? latestVersion.versionNumber + 1 : 1;

      await manager.save(TreatmentPlanVersion, {
        treatmentPlanId: planId,
        versionNumber: nextVersionNum,
        snapshot: updatedPlan,
        authorId,
      });

      await this.eventStore.logEvent('TREATMENT_PLAN_UPDATE', planId, authorId, { version: nextVersionNum });

      return updatedPlan;
    });
  }

  // Acceptance Criteria #2: Get List of Versions
  async getVersions(planId: string): Promise<any[]> {
    return this.versionRepo.find({
      where: { treatmentPlanId: planId },
      select: ['versionNumber', 'authorId', 'createdAt'],
      order: { versionNumber: 'DESC' },
    });
  }

  // Acceptance Criteria #3: Get JSON Diff between two specific versions
  async getDiff(planId: string, v1: number, v2: number): Promise<any> {
    const version1 = await this.versionRepo.findOne({ where: { treatmentPlanId: planId, versionNumber: v1 } });
    const version2 = await this.versionRepo.findOne({ where: { treatmentPlanId: planId, versionNumber: v2 } });

    if (!version1 || !version2) {
      throw new BadRequestException('One or both specified versions do not exist.');
    }

    // Computes JSON delta representation
    return this.differ.diff(version1.snapshot, version2.snapshot) || {};
  }

  async revertToVersion(planId: string, versionNumber: number, authorId: string): Promise<TreatmentPlan> {
    return this.dataSource.transaction(async (manager) => {
      const targetVersion = await manager.findOne(TreatmentPlanVersion, {
        where: { treatmentPlanId: planId, versionNumber },
      });

      if (!targetVersion) throw new NotFoundException(`Version ${versionNumber} does not exist for this plan.`);

      const plan = await manager.findOne(TreatmentPlan, {
        where: { id: planId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!plan) throw new NotFoundException('Treatment Plan not found');

      const cleanSnapshot = { ...targetVersion.snapshot };
      delete cleanSnapshot.id;

      Object.assign(plan, cleanSnapshot);
      const revertedPlan = await manager.save(TreatmentPlan, plan);

      const latestVersion = await manager.findOne(TreatmentPlanVersion, {
        where: { treatmentPlanId: planId },
        order: { versionNumber: 'DESC' },
        lock: { mode: 'pessimistic_write' },
      });
      const nextVersionNum = latestVersion ? latestVersion.versionNumber + 1 : 1;

      await manager.save(TreatmentPlanVersion, {
        treatmentPlanId: planId,
        versionNumber: nextVersionNum,
        snapshot: revertedPlan,
        authorId,
      });

      await this.eventStore.logEvent('TREATMENT_PLAN_REVERT', planId, authorId, {
        revertedToVersion: versionNumber,
        newVersionNumber: nextVersionNum,
      });

      return revertedPlan;
    });
  }
}