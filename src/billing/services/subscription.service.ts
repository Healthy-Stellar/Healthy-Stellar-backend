import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, Between } from 'typeorm';
import { SubscriptionPlan } from '../entities/subscription-plan.entity';
import { PatientSubscription } from '../entities/patient-subscription.entity';
import { Billing } from '../entities/billing.entity';
import { SubscriptionStatus, SubscriptionCadence } from '../../common/enums';
import {
  CreateSubscriptionPlanDto,
  UpdateSubscriptionPlanDto,
  CreatePatientSubscriptionDto,
  UpdatePatientSubscriptionDto,
  ChangeSubscriptionPlanDto,
  SubscriptionSearchDto,
} from '../dto/subscription.dto';

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    @InjectRepository(SubscriptionPlan)
    private readonly planRepository: Repository<SubscriptionPlan>,
    @InjectRepository(PatientSubscription)
    private readonly subscriptionRepository: Repository<PatientSubscription>,
    @InjectRepository(Billing)
    private readonly billingRepository: Repository<Billing>,
  ) {}

  // Subscription Plan Management

  async createPlan(createDto: CreateSubscriptionPlanDto): Promise<SubscriptionPlan> {
    const existingPlan = await this.planRepository.findOne({
      where: { name: createDto.name },
    });

    if (existingPlan) {
      throw new BadRequestException(`Subscription plan with name '${createDto.name}' already exists`);
    }

    const plan = this.planRepository.create({
      ...createDto,
      currency: createDto.currency || 'USD',
      trialPeriodDays: createDto.trialPeriodDays || 0,
      isActive: createDto.isActive !== undefined ? createDto.isActive : true,
    });

    return this.planRepository.save(plan);
  }

  async updatePlan(planId: string, updateDto: UpdateSubscriptionPlanDto): Promise<SubscriptionPlan> {
    const plan = await this.findPlanById(planId);

    Object.assign(plan, updateDto);

    return this.planRepository.save(plan);
  }

  async findPlanById(planId: string): Promise<SubscriptionPlan> {
    const plan = await this.planRepository.findOne({
      where: { id: planId },
    });

    if (!plan) {
      throw new NotFoundException(`Subscription plan with ID ${planId} not found`);
    }

    return plan;
  }

  async findPlanByName(name: string): Promise<SubscriptionPlan> {
    const plan = await this.planRepository.findOne({
      where: { name },
    });

    if (!plan) {
      throw new NotFoundException(`Subscription plan with name '${name}' not found`);
    }

    return plan;
  }

  async getAllPlans(activeOnly = false): Promise<SubscriptionPlan[]> {
    const where: FindOptionsWhere<SubscriptionPlan> = {};

    if (activeOnly) {
      where.isActive = true;
    }

    return this.planRepository.find({
      where,
      order: { price: 'ASC' },
    });
  }

  async deletePlan(planId: string): Promise<void> {
    const plan = await this.findPlanById(planId);

    const activeSubscriptions = await this.subscriptionRepository.count({
      where: { planId, status: SubscriptionStatus.ACTIVE },
    });

    if (activeSubscriptions > 0) {
      throw new BadRequestException(
        `Cannot delete plan with ${activeSubscriptions} active subscriptions`,
      );
    }

    await this.planRepository.remove(plan);
  }

  // Patient Subscription Management

  async createSubscription(createDto: CreatePatientSubscriptionDto): Promise<PatientSubscription> {
    const plan = await this.findPlanById(createDto.planId);

    if (!plan.isActive) {
      throw new BadRequestException(`Plan '${plan.name}' is not active`);
    }

    const existingSubscription = await this.subscriptionRepository.findOne({
      where: {
        patientId: createDto.patientId,
        status: SubscriptionStatus.ACTIVE,
      },
    });

    if (existingSubscription) {
      throw new BadRequestException(
        `Patient already has an active subscription (ID: ${existingSubscription.id})`,
      );
    }

    const startDate = new Date(createDto.startDate);
    const currentPeriodStart = new Date(startDate);
    const currentPeriodEnd = this.calculatePeriodEnd(currentPeriodStart, plan.cadence);

    const subscription = this.subscriptionRepository.create({
      patientId: createDto.patientId,
      patientName: createDto.patientName,
      planId: createDto.planId,
      plan,
      status: SubscriptionStatus.ACTIVE,
      startDate,
      endDate: createDto.endDate ? new Date(createDto.endDate) : null,
      currentPeriodStart,
      currentPeriodEnd,
      cadence: plan.cadence,
      currentPrice: plan.price,
      currency: plan.currency,
      autoRenew: createDto.autoRenew !== undefined ? createDto.autoRenew : true,
      maxFailedPaymentsBeforeSuspension:
        createDto.maxFailedPaymentsBeforeSuspension || 3,
      nextBillingDate: currentPeriodEnd,
      metadata: createDto.metadata,
    });

    return this.subscriptionRepository.save(subscription);
  }

  async findSubscriptionById(subscriptionId: string): Promise<PatientSubscription> {
    const subscription = await this.subscriptionRepository.findOne({
      where: { id: subscriptionId },
      relations: ['plan', 'invoices'],
    });

    if (!subscription) {
      throw new NotFoundException(`Subscription with ID ${subscriptionId} not found`);
    }

    return subscription;
  }

  async findSubscriptionByPatient(patientId: string): Promise<PatientSubscription[]> {
    return this.subscriptionRepository.find({
      where: { patientId },
      relations: ['plan'],
      order: { createdAt: 'DESC' },
    });
  }

  async findActiveSubscriptionByPatient(patientId: string): Promise<PatientSubscription | null> {
    return this.subscriptionRepository.findOne({
      where: {
        patientId,
        status: SubscriptionStatus.ACTIVE,
      },
      relations: ['plan'],
    });
  }

  async searchSubscriptions(searchDto: SubscriptionSearchDto): Promise<{
    data: PatientSubscription[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page = 1, limit = 20, ...filters } = searchDto;
    const skip = (page - 1) * limit;

    const where: FindOptionsWhere<PatientSubscription> = {};

    if (filters.patientId) {
      where.patientId = filters.patientId;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.planId) {
      where.planId = filters.planId;
    }

    const [data, total] = await this.subscriptionRepository.findAndCount({
      where,
      relations: ['plan'],
      skip,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return { data, total, page, limit };
  }

  async updateSubscription(
    subscriptionId: string,
    updateDto: UpdatePatientSubscriptionDto,
  ): Promise<PatientSubscription> {
    const subscription = await this.findSubscriptionById(subscriptionId);

    Object.assign(subscription, {
      ...updateDto,
      endDate: updateDto.endDate ? new Date(updateDto.endDate) : subscription.endDate,
      cancelledAt: updateDto.cancelledAt ? new Date(updateDto.cancelledAt) : subscription.cancelledAt,
    });

    return this.subscriptionRepository.save(subscription);
  }

  async changeSubscriptionPlan(
    subscriptionId: string,
    changeDto: ChangeSubscriptionPlanDto,
  ): Promise<PatientSubscription> {
    const subscription = await this.findSubscriptionById(subscriptionId);
    const newPlan = await this.findPlanById(changeDto.newPlanId);

    if (!newPlan.isActive) {
      throw new BadRequestException(`Plan '${newPlan.name}' is not active`);
    }

    const effectiveDate = changeDto.effectiveDate
      ? new Date(changeDto.effectiveDate)
      : new Date();

    if (effectiveDate < new Date()) {
      throw new BadRequestException('Effective date cannot be in the past');
    }

    subscription.planId = newPlan.id;
    subscription.plan = newPlan;
    subscription.cadence = newPlan.cadence;
    subscription.currentPrice = newPlan.price;
    subscription.currency = newPlan.currency;

    if (changeDto.prorate) {
      subscription.currentPeriodEnd = this.calculatePeriodEnd(effectiveDate, newPlan.cadence);
    }

    subscription.nextBillingDate = subscription.currentPeriodEnd;

    return this.subscriptionRepository.save(subscription);
  }

  async cancelSubscription(
    subscriptionId: string,
    reason?: string,
    immediate = false,
  ): Promise<PatientSubscription> {
    const subscription = await this.findSubscriptionById(subscriptionId);

    if (subscription.status === SubscriptionStatus.CANCELLED) {
      throw new BadRequestException('Subscription is already cancelled');
    }

    subscription.status = SubscriptionStatus.CANCELLED;
    subscription.cancelledAt = new Date();
    subscription.cancellationReason = reason || 'Cancelled by user';
    subscription.autoRenew = false;

    if (immediate) {
      subscription.endDate = new Date();
      subscription.currentPeriodEnd = new Date();
    } else {
      subscription.endDate = subscription.currentPeriodEnd;
    }

    return this.subscriptionRepository.save(subscription);
  }

  async suspendSubscription(subscriptionId: string, reason?: string): Promise<PatientSubscription> {
    const subscription = await this.findSubscriptionById(subscriptionId);

    if (subscription.status === SubscriptionStatus.SUSPENDED) {
      throw new BadRequestException('Subscription is already suspended');
    }

    subscription.status = SubscriptionStatus.SUSPENDED;
    subscription.metadata = {
      ...subscription.metadata,
      suspensionReason: reason || 'Payment failure threshold exceeded',
      suspendedAt: new Date().toISOString(),
    };

    return this.subscriptionRepository.save(subscription);
  }

  async reactivateSubscription(subscriptionId: string): Promise<PatientSubscription> {
    const subscription = await this.findSubscriptionById(subscriptionId);

    if (subscription.status !== SubscriptionStatus.SUSPENDED) {
      throw new BadRequestException('Only suspended subscriptions can be reactivated');
    }

    subscription.status = SubscriptionStatus.ACTIVE;
    subscription.consecutiveFailedPayments = 0;
    subscription.nextBillingDate = new Date();

    return this.subscriptionRepository.save(subscription);
  }

  // Helper Methods

  private calculatePeriodEnd(startDate: Date, cadence: SubscriptionCadence): Date {
    const endDate = new Date(startDate);

    switch (cadence) {
      case SubscriptionCadence.MONTHLY:
        endDate.setMonth(endDate.getMonth() + 1);
        break;
      case SubscriptionCadence.QUARTERLY:
        endDate.setMonth(endDate.getMonth() + 3);
        break;
      case SubscriptionCadence.ANNUAL:
        endDate.setFullYear(endDate.getFullYear() + 1);
        break;
    }

    return endDate;
  }

  async getSubscriptionsDueForRenewal(): Promise<PatientSubscription[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return this.subscriptionRepository.find({
      where: {
        status: SubscriptionStatus.ACTIVE,
        nextBillingDate: Between(today, today),
      },
      relations: ['plan'],
    });
  }

  async incrementFailedPaymentCount(subscriptionId: string): Promise<PatientSubscription> {
    const subscription = await this.findSubscriptionById(subscriptionId);

    subscription.consecutiveFailedPayments += 1;

    if (subscription.consecutiveFailedPayments >= subscription.maxFailedPaymentsBeforeSuspension) {
      subscription.status = SubscriptionStatus.SUSPENDED;
      subscription.metadata = {
        ...subscription.metadata,
        suspensionReason: 'Maximum failed payment threshold exceeded',
        suspendedAt: new Date().toISOString(),
      };
    } else {
      subscription.status = SubscriptionStatus.PAST_DUE;
    }

    return this.subscriptionRepository.save(subscription);
  }

  async resetFailedPaymentCount(subscriptionId: string): Promise<PatientSubscription> {
    const subscription = await this.findSubscriptionById(subscriptionId);

    subscription.consecutiveFailedPayments = 0;

    if (subscription.status === SubscriptionStatus.PAST_DUE || subscription.status === SubscriptionStatus.SUSPENDED) {
      subscription.status = SubscriptionStatus.ACTIVE;
    }

    return this.subscriptionRepository.save(subscription);
  }

  async updateNextBillingDate(subscriptionId: string): Promise<PatientSubscription> {
    const subscription = await this.findSubscriptionById(subscriptionId);

    const nextPeriodStart = new Date(subscription.currentPeriodEnd);
    const nextPeriodEnd = this.calculatePeriodEnd(nextPeriodStart, subscription.cadence);

    subscription.currentPeriodStart = nextPeriodStart;
    subscription.currentPeriodEnd = nextPeriodEnd;
    subscription.nextBillingDate = nextPeriodEnd;

    return this.subscriptionRepository.save(subscription);
  }
}
