import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
  ) {}

  // Save or update plan, generating a new immutable snapshot row
  async savePlan(planId: string, updateData: any, authorId: string): Promise<TreatmentPlan> {
    let plan = await this.planRepo.findOne({ where: { id: planId } });
    
    if (!plan) {
      throw new NotFoundException('Treatment Plan not found');
    }

    // Update root entity fields
    Object.assign(plan, updateData);
    const updatedPlan = await this.planRepo.save(plan);

    // Calculate next version number
    const latestVersion = await this.versionRepo.findOne({
      where: { treatmentPlanId: planId },
      order: { versionNumber: 'DESC' },
    });
    const nextVersionNum = latestVersion ? latestVersion.versionNumber + 1 : 1;

    // Persist immutable snapshot version
    await this.versionRepo.save({
      treatmentPlanId: planId,
      versionNumber: nextVersionNum,
      snapshot: updatedPlan,
      authorId,
    });

    // Write audit trails
    await this.eventStore.logEvent('TREATMENT_PLAN_UPDATE', planId, authorId, { version: nextVersionNum });

    return updatedPlan;
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

  // Acceptance Criteria #4: Revert state back to an old version
  async revertToVersion(planId: string, versionNumber: number, authorId: string): Promise<TreatmentPlan> {
    const targetVersion = await this.versionRepo.findOne({
      where: { treatmentPlanId: planId, versionNumber },
    });

    if (!targetVersion) {
      throw new NotFoundException(`Version ${versionNumber} does not exist for this plan.`);
    }

    // Overwrite existing plan payload with historical content safely
    let plan = await this.planRepo.findOne({ where: { id: planId } });
    if (!plan) throw new NotFoundException('Treatment Plan not found');

    const cleanSnapshot = { ...targetVersion.snapshot };
    delete cleanSnapshot.id; // Avoid attempting to change primary keys

    Object.assign(plan, cleanSnapshot);
    const revertedPlan = await this.planRepo.save(plan);

    // Increment version line for the revert action itself
    const latestVersion = await this.versionRepo.findOne({
      where: { treatmentPlanId: planId },
      order: { versionNumber: 'DESC' },
    });
    const nextVersionNum = latestVersion ? latestVersion.versionNumber + 1 : 1;

    await this.versionRepo.save({
      treatmentPlanId: planId,
      versionNumber: nextVersionNum,
      snapshot: revertedPlan,
      authorId,
    });

    // Write audit trail documenting the reversion mapping
    await this.eventStore.logEvent('TREATMENT_PLAN_REVERT', planId, authorId, {
      revertedToVersion: versionNumber,
      newVersionNumber: nextVersionNum,
    });

    return revertedPlan;
  }
}