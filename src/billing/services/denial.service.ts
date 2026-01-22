import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, Between } from 'typeorm';
import { ClaimDenial } from '../entities/claim-denial.entity';
import { ClaimAppeal } from '../entities/claim-appeal.entity';
import { InsuranceClaim } from '../entities/insurance-claim.entity';
import {
  CreateDenialDto,
  UpdateDenialDto,
  CreateAppealDto,
  UpdateAppealDto,
  DenialSearchDto,
  AppealSearchDto,
} from '../dto/denial.dto';
import { ClaimStatus, AppealStatus } from '../../common/enums';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class DenialService {
  constructor(
    @InjectRepository(ClaimDenial)
    private readonly denialRepository: Repository<ClaimDenial>,
    @InjectRepository(ClaimAppeal)
    private readonly appealRepository: Repository<ClaimAppeal>,
    @InjectRepository(InsuranceClaim)
    private readonly claimRepository: Repository<InsuranceClaim>,
  ) {}

  async createDenial(createDto: CreateDenialDto): Promise<ClaimDenial> {
    const claim = await this.claimRepository.findOne({
      where: { id: createDto.claimId },
    });

    if (!claim) {
      throw new NotFoundException(`Claim with ID ${createDto.claimId} not found`);
    }

    const denialNumber = `DEN-${Date.now()}-${uuidv4().substring(0, 4).toUpperCase()}`;

    const denial = this.denialRepository.create({
      denialNumber,
      claimId: createDto.claimId,
      denialDate: new Date(createDto.denialDate),
      primaryReason: createDto.primaryReason,
      additionalReasons: createDto.additionalReasons,
      denialCodes: createDto.denialCodes,
      deniedAmount: createDto.deniedAmount,
      payerExplanation: createDto.payerExplanation,
      internalNotes: createDto.internalNotes,
      isAppealable: createDto.isAppealable ?? true,
      appealDeadline: createDto.appealDeadline
        ? new Date(createDto.appealDeadline)
        : new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
      requiredActions: createDto.requiredActions,
      assignedTo: createDto.assignedTo,
      priority: createDto.priority || 1,
    });

    await this.denialRepository.save(denial);

    claim.status = ClaimStatus.DENIED;
    await this.claimRepository.save(claim);

    return denial;
  }

  async findDenialById(id: string): Promise<ClaimDenial> {
    const denial = await this.denialRepository.findOne({
      where: { id },
      relations: ['claim', 'appeals'],
    });

    if (!denial) {
      throw new NotFoundException(`Denial with ID ${id} not found`);
    }

    return denial;
  }

  async searchDenials(searchDto: DenialSearchDto): Promise<{
    data: ClaimDenial[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page = 1, limit = 20, ...filters } = searchDto;
    const skip = (page - 1) * limit;

    const where: FindOptionsWhere<ClaimDenial> = {};

    if (filters.claimId) {
      where.claimId = filters.claimId;
    }

    if (filters.primaryReason) {
      where.primaryReason = filters.primaryReason;
    }

    if (filters.isResolved !== undefined) {
      where.isResolved = filters.isResolved;
    }

    if (filters.isAppealable !== undefined) {
      where.isAppealable = filters.isAppealable;
    }

    if (filters.assignedTo) {
      where.assignedTo = filters.assignedTo;
    }

    if (filters.startDate && filters.endDate) {
      where.denialDate = Between(
        new Date(filters.startDate),
        new Date(filters.endDate),
      );
    }

    const [data, total] = await this.denialRepository.findAndCount({
      where,
      relations: ['claim', 'appeals'],
      skip,
      take: limit,
      order: { denialDate: 'DESC' },
    });

    return { data, total, page, limit };
  }

  async updateDenial(id: string, updateDto: UpdateDenialDto): Promise<ClaimDenial> {
    const denial = await this.findDenialById(id);

    Object.assign(denial, {
      ...updateDto,
      appealDeadline: updateDto.appealDeadline
        ? new Date(updateDto.appealDeadline)
        : denial.appealDeadline,
      resolvedAt: updateDto.isResolved ? new Date() : denial.resolvedAt,
    });

    return this.denialRepository.save(denial);
  }

  async createAppeal(createDto: CreateAppealDto): Promise<ClaimAppeal> {
    const denial = await this.findDenialById(createDto.denialId);

    if (!denial.isAppealable) {
      throw new BadRequestException('This denial is not appealable');
    }

    if (denial.appealDeadline && new Date() > denial.appealDeadline) {
      throw new BadRequestException('Appeal deadline has passed');
    }

    const existingAppeals = await this.appealRepository.find({
      where: { denialId: createDto.denialId },
      order: { appealLevel: 'DESC' },
    });

    const nextLevel = createDto.appealLevel ||
      (existingAppeals.length > 0 ? existingAppeals[0].appealLevel + 1 : 1);

    if (nextLevel > 3) {
      throw new BadRequestException('Maximum appeal level (3) reached');
    }

    const appealNumber = `APL-${Date.now()}-${uuidv4().substring(0, 4).toUpperCase()}`;

    const appeal = this.appealRepository.create({
      appealNumber,
      denialId: createDto.denialId,
      claimId: denial.claimId,
      appealLevel: nextLevel,
      status: AppealStatus.DRAFT,
      appealReason: createDto.appealReason,
      clinicalJustification: createDto.clinicalJustification,
      supportingDocuments: createDto.supportingDocuments?.map((doc) => ({
        ...doc,
        uploadedAt: new Date().toISOString(),
      })),
      additionalCodes: createDto.additionalCodes,
      appealedAmount: createDto.appealedAmount,
      assignedTo: createDto.assignedTo,
      deadline: createDto.deadline
        ? new Date(createDto.deadline)
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      timeline: [
        {
          date: new Date().toISOString(),
          action: 'Appeal created',
          notes: 'Initial appeal draft created',
        },
      ],
    });

    return this.appealRepository.save(appeal);
  }

  async findAppealById(id: string): Promise<ClaimAppeal> {
    const appeal = await this.appealRepository.findOne({
      where: { id },
      relations: ['denial', 'denial.claim'],
    });

    if (!appeal) {
      throw new NotFoundException(`Appeal with ID ${id} not found`);
    }

    return appeal;
  }

  async searchAppeals(searchDto: AppealSearchDto): Promise<{
    data: ClaimAppeal[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page = 1, limit = 20, ...filters } = searchDto;
    const skip = (page - 1) * limit;

    const where: FindOptionsWhere<ClaimAppeal> = {};

    if (filters.claimId) {
      where.claimId = filters.claimId;
    }

    if (filters.denialId) {
      where.denialId = filters.denialId;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.appealLevel) {
      where.appealLevel = filters.appealLevel;
    }

    if (filters.assignedTo) {
      where.assignedTo = filters.assignedTo;
    }

    if (filters.startDate && filters.endDate) {
      where.submittedDate = Between(
        new Date(filters.startDate),
        new Date(filters.endDate),
      );
    }

    const [data, total] = await this.appealRepository.findAndCount({
      where,
      relations: ['denial'],
      skip,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return { data, total, page, limit };
  }

  async updateAppeal(id: string, updateDto: UpdateAppealDto): Promise<ClaimAppeal> {
    const appeal = await this.findAppealById(id);

    const timeline = [...(appeal.timeline || [])];

    if (updateDto.status && updateDto.status !== appeal.status) {
      timeline.push({
        date: new Date().toISOString(),
        action: `Status changed to ${updateDto.status}`,
      });
    }

    Object.assign(appeal, {
      ...updateDto,
      submittedDate: updateDto.submittedDate
        ? new Date(updateDto.submittedDate)
        : appeal.submittedDate,
      decisionDate: updateDto.decisionDate
        ? new Date(updateDto.decisionDate)
        : appeal.decisionDate,
      timeline,
    });

    return this.appealRepository.save(appeal);
  }

  async submitAppeal(id: string): Promise<ClaimAppeal> {
    const appeal = await this.findAppealById(id);

    if (appeal.status !== AppealStatus.DRAFT) {
      throw new BadRequestException('Can only submit appeals in draft status');
    }

    appeal.status = AppealStatus.SUBMITTED;
    appeal.submittedDate = new Date();
    appeal.timeline = [
      ...(appeal.timeline || []),
      {
        date: new Date().toISOString(),
        action: 'Appeal submitted to payer',
      },
    ];

    await this.appealRepository.save(appeal);

    const denial = await this.findDenialById(appeal.denialId);
    const claim = await this.claimRepository.findOne({
      where: { id: denial.claimId },
    });

    if (claim) {
      claim.status = ClaimStatus.APPEALED;
      await this.claimRepository.save(claim);
    }

    return appeal;
  }

  async processAppealDecision(
    id: string,
    decision: {
      approved: boolean;
      approvedAmount?: number;
      payerResponse: string;
      payerReferenceNumber?: string;
    },
  ): Promise<ClaimAppeal> {
    const appeal = await this.findAppealById(id);

    appeal.status = decision.approved ? AppealStatus.APPROVED : AppealStatus.DENIED;
    appeal.decisionDate = new Date();
    appeal.payerResponse = decision.payerResponse;
    if (decision.payerReferenceNumber) {
      appeal.payerReferenceNumber = decision.payerReferenceNumber;
    }
    if (decision.approvedAmount !== undefined) {
      appeal.approvedAmount = decision.approvedAmount;
    }
    appeal.timeline = [
      ...(appeal.timeline || []),
      {
        date: new Date().toISOString(),
        action: `Appeal ${decision.approved ? 'approved' : 'denied'} by payer`,
        notes: decision.payerResponse,
      },
    ];

    await this.appealRepository.save(appeal);

    const denial = await this.findDenialById(appeal.denialId);

    if (decision.approved) {
      denial.isResolved = true;
      denial.resolvedAt = new Date();
      denial.resolutionType = 'appeal_approved';
      denial.recoveredAmount = decision.approvedAmount || denial.deniedAmount;
      await this.denialRepository.save(denial);

      const claim = await this.claimRepository.findOne({
        where: { id: denial.claimId },
      });

      if (claim) {
        claim.status = ClaimStatus.PAID;
        claim.paidAmount = Number(claim.paidAmount) + (decision.approvedAmount || 0);
        await this.claimRepository.save(claim);
      }
    }

    return appeal;
  }

  async getDenialAnalytics(
    startDate: Date,
    endDate: Date,
  ): Promise<{
    totalDenials: number;
    totalDeniedAmount: number;
    byReason: Array<{ reason: string; count: number; amount: number }>;
    appealRate: number;
    overturnRate: number;
    averageRecovery: number;
  }> {
    const denials = await this.denialRepository.find({
      where: {
        denialDate: Between(startDate, endDate),
      },
      relations: ['appeals'],
    });

    const byReason: Record<string, { count: number; amount: number }> = {};
    let appealedCount = 0;
    let overturnedCount = 0;
    let totalRecovered = 0;

    for (const denial of denials) {
      const reason = denial.primaryReason;
      if (!byReason[reason]) {
        byReason[reason] = { count: 0, amount: 0 };
      }
      byReason[reason].count += 1;
      byReason[reason].amount += Number(denial.deniedAmount);

      if (denial.appeals && denial.appeals.length > 0) {
        appealedCount += 1;

        const approvedAppeal = denial.appeals.find(
          (a) => a.status === AppealStatus.APPROVED,
        );
        if (approvedAppeal) {
          overturnedCount += 1;
          totalRecovered += Number(approvedAppeal.approvedAmount || 0);
        }
      }
    }

    return {
      totalDenials: denials.length,
      totalDeniedAmount: denials.reduce(
        (sum, d) => sum + Number(d.deniedAmount),
        0,
      ),
      byReason: Object.entries(byReason).map(([reason, data]) => ({
        reason,
        ...data,
      })),
      appealRate: denials.length > 0 ? (appealedCount / denials.length) * 100 : 0,
      overturnRate: appealedCount > 0 ? (overturnedCount / appealedCount) * 100 : 0,
      averageRecovery: overturnedCount > 0 ? totalRecovered / overturnedCount : 0,
    };
  }

  async getPendingAppeals(): Promise<ClaimAppeal[]> {
    return this.appealRepository.find({
      where: [
        { status: AppealStatus.SUBMITTED },
        { status: AppealStatus.UNDER_REVIEW },
      ],
      relations: ['denial', 'denial.claim'],
      order: { submittedDate: 'ASC' },
    });
  }

  async getUpcomingDeadlines(days: number = 30): Promise<ClaimDenial[]> {
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + days);

    return this.denialRepository.find({
      where: {
        isResolved: false,
        isAppealable: true,
        appealDeadline: Between(new Date(), deadline),
      },
      relations: ['claim'],
      order: { appealDeadline: 'ASC' },
    });
  }
}
