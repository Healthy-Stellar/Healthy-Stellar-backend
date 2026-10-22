import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, Between } from 'typeorm';
import { Subscription, SubscriptionStatus } from './entities/subscription.entity';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';

@Injectable()
export class SubscriptionService {
  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
  ) {}

  async create(createSubscriptionDto: CreateSubscriptionDto): Promise<Subscription> {
    const subscription = this.subscriptionRepository.create(createSubscriptionDto);
    return this.subscriptionRepository.save(subscription);
  }

  async findAll(): Promise<Subscription[]> {
    return this.subscriptionRepository.find({
      relations: ['tenant', 'plan'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Subscription> {
    const subscription = await this.subscriptionRepository.findOne({
      where: { id },
      relations: ['tenant', 'plan'],
    });

    if (!subscription) {
      throw new NotFoundException(`Subscription with ID ${id} not found`);
    }

    return subscription;
  }

  async findByTenant(tenantId: string): Promise<Subscription[]> {
    return this.subscriptionRepository.find({
      where: { tenantId },
      relations: ['plan'],
      order: { createdAt: 'DESC' },
    });
  }

  async update(id: string, updateSubscriptionDto: UpdateSubscriptionDto): Promise<Subscription> {
    const subscription = await this.findOne(id);
    Object.assign(subscription, updateSubscriptionDto);
    return this.subscriptionRepository.save(subscription);
  }

  async remove(id: string): Promise<void> {
    const subscription = await this.findOne(id);
    await this.subscriptionRepository.remove(subscription);
  }

  async cancel(id: string): Promise<Subscription> {
    const subscription = await this.findOne(id);
    subscription.status = SubscriptionStatus.CANCELLED;
    subscription.cancelledAt = new Date();
    return this.subscriptionRepository.save(subscription);
  }

  async getSubscriptionsDueForRenewal(): Promise<Subscription[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const endOfToday = new Date(today);
    endOfToday.setHours(23, 59, 59, 999);

    return this.subscriptionRepository.find({
      where: {
        status: SubscriptionStatus.ACTIVE,
        nextBillingDate: LessThanOrEqual(endOfToday),
      },
      relations: ['tenant', 'plan'],
      order: { nextBillingDate: 'ASC' },
    });
  }

  async getActiveSubscriptions(): Promise<Subscription[]> {
    return this.subscriptionRepository.find({
      where: { status: SubscriptionStatus.ACTIVE },
      relations: ['tenant', 'plan'],
    });
  }

  async getSubscriptionsByStatus(status: SubscriptionStatus): Promise<Subscription[]> {
    return this.subscriptionRepository.find({
      where: { status },
      relations: ['tenant', 'plan'],
      order: { createdAt: 'DESC' },
    });
  }

  async getSubscriptionsExpiringBetween(startDate: Date, endDate: Date): Promise<Subscription[]> {
    return this.subscriptionRepository.find({
      where: {
        status: SubscriptionStatus.ACTIVE,
        nextBillingDate: Between(startDate, endDate),
      },
      relations: ['tenant', 'plan'],
      order: { nextBillingDate: 'ASC' },
    });
  }
}
