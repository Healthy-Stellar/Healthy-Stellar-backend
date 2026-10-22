import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryRunner } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Billing } from '../billing/entities/billing.entity';
import { BillingLineItem } from '../billing/entities/billing-line-item.entity';
import { Payment } from '../billing/entities/payment.entity';
import { Subscription } from '../subscription/entities/subscription.entity';

@Injectable()
export class SubscriptionRenewalTask {
  private readonly logger = new Logger(SubscriptionRenewalTask.name);

  constructor(
    @InjectRepository(Billing)
    private readonly billingRepo: Repository<Billing>,
    @InjectRepository(BillingLineItem)
    private readonly billingLineItemRepo: Repository<BillingLineItem>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleSubscriptionRenewals(): Promise<void> {
    this.logger.log('Starting subscription renewal processing');

    const dueSubscriptions = await this.subscriptionRepo.find({
      where: { status: 'active', autoRenew: true },
    });

    for (const subscription of dueSubscriptions) {
      try {
        await this.generateAndChargeRenewalInvoice(subscription);
      } catch (error) {
        this.logger.error(
          `Failed to process renewal for subscription ${subscription.id}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }

    this.logger.log('Finished subscription renewal processing');
  }

  async generateAndChargeRenewalInvoice(subscription: Subscription): Promise<void> {
    const queryRunner: QueryRunner = this.billingRepo.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const billing = queryRunner.manager.create(Billing, {
        subscriptionId: subscription.id,
        status: 'pending',
        amount: subscription.amount,
        dueDate: new Date(),
      });
      await queryRunner.manager.save(Billing, billing);

      const lineItem = queryRunner.manager.create(BillingLineItem, {
        billingId: billing.id,
        description: `Renewal for subscription ${subscription.id}`,
        amount: subscription.amount,
        quantity: 1,
      });
      await queryRunner.manager.save(BillingLineItem, lineItem);

      const payment = queryRunner.manager.create(Payment, {
        billingId: billing.id,
        amount: subscription.amount,
        status: 'pending',
      });
      await queryRunner.manager.save(Payment, payment);

      await this.simulatePaymentProcessing(payment, queryRunner);

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async simulatePaymentProcessing(
    payment: Payment,
    queryRunner: QueryRunner,
  ): Promise<void> {
    try {
      // Simulate interaction with an external payment gateway.
      const succeeded = await this.chargePaymentGateway(payment);

      if (succeeded) {
        payment.status = 'completed';
        await queryRunner.manager.save(Payment, payment);
      } else {
        payment.status = 'failed';
        await queryRunner.manager.save(Payment, payment);
      }
    } catch (error) {
      payment.status = 'failed';
      await queryRunner.manager.save(Payment, payment);
      throw error;
    }
  }

  private async chargePaymentGateway(payment: Payment): Promise<boolean> {
    // Placeholder for the actual payment gateway integration.
    return payment.amount > 0;
  }
}
