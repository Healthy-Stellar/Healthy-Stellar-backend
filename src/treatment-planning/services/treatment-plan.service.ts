import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, Between } from 'typeorm';
import { TreatmentPlan } from '../entities/treatment-plan.entity';
import { TreatmentPlanVersion } from '../entities/treatment-plan-version.entity';
import {
  CreateTreatmentPlanDto,
  UpdateTreatmentPlanDto,
  SearchTreatmentPlansDto,
} from '../dto/treatment-planning.dto';
import { TreatmentPlanStatus } from '../../common/enums';
import { Diagnosis } from '../../diagnosis/entities/diagnosis.entity';
import { DecisionSupportService } from './decision-support.service';

@Injectable()
export class TreatmentPlanService {
  constructor(
    @InjectRepository(TreatmentPlan)
    private readonly treatmentPlanRepository: Repository<TreatmentPlan>,
    @InjectRepository(TreatmentPlanVersion)
    private readonly versionRepository: Repository<TreatmentPlanVersion>,
    @InjectRepository(Diagnosis)
    private readonly diagnosisRepository: Repository<Diagnosis>,
    private readonly decisionSupportService: DecisionSupportService,
  ) {}

  async create(createDto: CreateTreatmentPlanDto): Promise<TreatmentPlan> {
    await this.validateDiagnosisIds(createDto.diagnosisIds);
    const plan = this.treatmentPlanRepository.create(createDto);
    const savedPlan = await this.treatmentPlanRepository.save(plan);

    // Create initial version
    await this.createVersion(savedPlan, 'Initial plan created', createDto.createdBy);
    if (savedPlan.diagnosisIds?.length) {
      await this.decisionSupportService.evaluateTreatmentPlan(savedPlan.id, savedPlan.diagnosisIds);
    }

    return savedPlan;
  }

  async findById(id: string): Promise<TreatmentPlan> {
    const plan = await this.treatmentPlanRepository.findOne({
      where: { id },
      relations: ['procedures', 'outcomes', 'versions'],
    });

    if (!plan) {
      throw new NotFoundException(`Treatment plan with ID ${id} not found`);
    }

    return plan;
  }

  async findByPatientId(patientId: string): Promise<TreatmentPlan[]> {
    return await this.treatmentPlanRepository.find({
      where: { patientId },
      order: { createdAt: 'DESC' },
    });
  }

  async update(id: string, updateDto: UpdateTreatmentPlanDto): Promise<TreatmentPlan> {
    const plan = await this.findById(id);
    await this.validateDiagnosisIds(updateDto.diagnosisIds);

    // Create new version before updating
    if (updateDto.changeNotes || this.hasSignificantChanges(updateDto)) {
      plan.version += 1;
      await this.createVersion(plan, updateDto.changeNotes, updateDto.updatedBy);
    }

    Object.assign(plan, updateDto);
    const updated = await this.treatmentPlanRepository.save(plan);
    if (updated.diagnosisIds?.length) {
      await this.decisionSupportService.evaluateTreatmentPlan(updated.id, updated.diagnosisIds);
    }
    return updated;
  }

  async findByDiagnosisId(diagnosisId: string): Promise<TreatmentPlan[]> {
    return await this.treatmentPlanRepository
      .createQueryBuilder('plan')
      .where(':diagnosisId = ANY(string_to_array(plan.diagnosisIds, \',\'))', { diagnosisId })
      .orderBy('plan.createdAt', 'DESC')
      .getMany();
  }

  async search(searchDto: SearchTreatmentPlansDto): Promise<TreatmentPlan[]> {
    const queryBuilder = this.treatmentPlanRepository.createQueryBuilder('plan');

    if (searchDto.patientId) {
      queryBuilder.andWhere('plan.patientId = :patientId', { patientId: searchDto.patientId });
    }

    if (searchDto.primaryProviderId) {
      queryBuilder.andWhere('plan.primaryProviderId = :primaryProviderId', {
        primaryProviderId: searchDto.primaryProviderId,
      });
    }

    if (searchDto.status) {
      queryBuilder.andWhere('plan.status = :status', { status: searchDto.status });
    }

    if (searchDto.diagnosisId) {
      queryBuilder.andWhere(':diagnosisId = ANY(string_to_array(plan.diagnosisIds, \',\'))', {
        diagnosisId: searchDto.diagnosisId,
      });
    }

    if (searchDto.startDateFrom && searchDto.startDateTo) {
      queryBuilder.andWhere('plan.startDate BETWEEN :startDateFrom AND :startDateTo', {
        startDateFrom: new Date(searchDto.startDateFrom),
        startDateTo: new Date(searchDto.startDateTo),
      });
    } else if (searchDto.startDateFrom) {
      queryBuilder.andWhere('plan.startDate >= :startDateFrom', {
        startDateFrom: new Date(searchDto.startDateFrom),
      });
    } else if (searchDto.startDateTo) {
      queryBuilder.andWhere('plan.startDate <= :startDateTo', {
        startDateTo: new Date(searchDto.startDateTo),
      });
    }

    return await queryBuilder.orderBy('plan.createdAt', searchDto.sortOrder || 'DESC').getMany();
  }

  async updateStatus(
    id: string,
    status: TreatmentPlanStatus,
    updatedBy?: string,
  ): Promise<TreatmentPlan> {
    const plan = await this.findById(id);
    plan.status = status;
    plan.updatedBy = updatedBy;

    if (status === TreatmentPlanStatus.COMPLETED) {
      plan.completedDate = new Date();
    }

    return await this.treatmentPlanRepository.save(plan);
  }

  async delete(id: string): Promise<void> {
    const plan = await this.findById(id);
    await this.treatmentPlanRepository.remove(plan);
  }

  async getActivePlans(patientId: string): Promise<TreatmentPlan[]> {
    return await this.treatmentPlanRepository.find({
      where: {
        patientId,
        status: TreatmentPlanStatus.ACTIVE,
      },
      order: { startDate: 'DESC' },
    });
  }

  async getVersionHistory(planId: string): Promise<TreatmentPlanVersion[]> {
    return await this.versionRepository.find({
      where: { treatmentPlanId: planId },
      order: { version: 'DESC' },
    });
  }

  async getProgress(planId: string): Promise<{
    progressPercentage: number;
    objectives: { total: number; completed: number };
    goals: { total: number; achieved: number };
    procedures: { total: number; completed: number };
    outcomesRecorded: number;
  }> {
    const plan = await this.findById(planId);
    const totalObjectives = plan.objectives?.length || 0;
    const completedObjectives =
      plan.objectives?.filter((objective) => objective.status === 'completed').length || 0;
    const totalGoals = plan.goals?.length || 0;
    const achievedGoals = plan.goals?.filter((goal) => goal.achieved).length || 0;
    const totalProcedures = plan.procedures?.length || 0;
    const completedProcedures =
      plan.procedures?.filter((procedure) => procedure.status === 'completed').length || 0;
    const outcomesRecorded = plan.outcomes?.length || 0;

    const objectiveScore = totalObjectives > 0 ? completedObjectives / totalObjectives : 0;
    const goalScore = totalGoals > 0 ? achievedGoals / totalGoals : 0;
    const procedureScore = totalProcedures > 0 ? completedProcedures / totalProcedures : 0;
    const progressPercentage = Math.round(
      ((objectiveScore + goalScore + procedureScore) / 3) * 100,
    );

    return {
      progressPercentage,
      objectives: { total: totalObjectives, completed: completedObjectives },
      goals: { total: totalGoals, achieved: achievedGoals },
      procedures: { total: totalProcedures, completed: completedProcedures },
      outcomesRecorded,
    };
  }

  private async createVersion(
    plan: TreatmentPlan,
    changeNotes?: string,
    createdBy?: string,
  ): Promise<TreatmentPlanVersion> {
    const snapshot = {
      title: plan.title,
      description: plan.description,
      status: plan.status,
      diagnosisIds: plan.diagnosisIds,
      goals: plan.goals,
      objectives: plan.objectives,
      interventions: plan.interventions,
      medications: plan.medications,
      reviewSchedule: plan.reviewSchedule,
      specialInstructions: plan.specialInstructions,
      patientEducation: plan.patientEducation,
    };

    const version = this.versionRepository.create({
      treatmentPlanId: plan.id,
      version: plan.version,
      snapshot,
      changeNotes,
      createdBy,
    });

    return await this.versionRepository.save(version);
  }

  private hasSignificantChanges(updateDto: UpdateTreatmentPlanDto): boolean {
    return !!(
      updateDto.goals ||
      updateDto.objectives ||
      updateDto.interventions ||
      updateDto.medications ||
      updateDto.status
    );
  }

  private async validateDiagnosisIds(diagnosisIds?: string[]): Promise<void> {
    if (!diagnosisIds || diagnosisIds.length === 0) {
      return;
    }

    const found = await this.diagnosisRepository.find({
      where: diagnosisIds.map((id) => ({ id })),
      select: ['id'],
    });

    if (found.length !== diagnosisIds.length) {
      const foundIds = new Set(found.map((item) => item.id));
      const missing = diagnosisIds.filter((id) => !foundIds.has(id));
      throw new BadRequestException(`Invalid diagnosis IDs: ${missing.join(', ')}`);
    }
  }
}
