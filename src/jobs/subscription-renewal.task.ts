import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { PatientSubscription } from '../billing/entities/patient-subscription.entity';
import { Billing } from '../billing/entities/billing.entity';
import { BillingLineItem } from '../billing/entities/billing-line-item.entity';
import { Payment } from '../billing/entities/payment.entity';
import { SubscriptionStatus, PaymentStatus, PaymentMethod } from '../common/enums';
import { SubscriptionService } from '../billing/services/subscription.service';
import { PaymentService } from '../billing/services/payment.service';
import { v4 as uuidv4 } from 'uuid';
import { RedisLockService } from '../common/utils/redis-lock.service';

@Injectable()
export class SubscriptionRenewalTask {
  private readonly logger = new Logger(SubscriptionRenewalTask.name);
  private readonly LOCK_KEY = 'lock:subscription-renewal';
  private readonly LOCK_TTL_MS = 300_000; // 5 minutes

  constructor(
    @InjectRepository(PatientSubscription)
    private readonly subscriptionRepo: Repository<PatientSubscription>,
    @InjectRepository(Billing)
    private readonly billingRepo: Repository<Billing>,
    @InjectRepository(BillingLineItem)
    private readonly lineItemRepo: Repository<BillingLineItem>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    private readonly subscriptionService: SubscriptionService,
    private readonly paymentService: PaymentService,
    private readonly dataSource: DataSource,
    private readonly redisLock: RedisLockService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async processRenewals(): Promise<void> {
    const startTime = Date.now();
    this.logger.log('SubscriptionRenewalTask started');

    const acquired = await this.redisLock.acquireLock(this.LOCK_KEY, this.LOCK_TTL_MS);
    if (!acquired) {
      this.logger.warn('Could not acquire distributed lock; skipping renewal processing');
      return;
    }

    let processed = 0;
    let successful = 0;
    let failed = 0;
    const errors: string[] = [];

    try {
      const subscriptions = await this.subscriptionService.getSubscriptionsDueForRenewal();

      this.logger.log(`Found ${subscriptions.length} subscriptions due for renewal`);

      for (const subscription of subscriptions) {
        try {
          await this.processSubscriptionRenewal(subscription);
          successful++;
          processed++;
        } catch (error) {
          failed++;
          const message = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Subscription ${subscription.id}: ${message}`);
          this.logger.error(`Failed to process subscription ${subscription.id}: ${message}`);
        }
      }
    } finally {
      await this.redisLock.releaseLock(this.LOCK_KEY);
      const duration = Date.now() - startTime;
      this.logger.log(
        `SubscriptionRenewalTask finished — processed: ${processed}, successful: ${successful}, failed: ${failed}, duration: ${duration}ms, errors: ${errors.length}`,
      );
      if (errors.length > 0) {
        this.logger.error(`Errors: ${errors.join(', ')}`);
      }
    }
  }

  private async processSubscriptionRenewal(subscription: PatientSubscription): Promise<void> {
    this.logger.log(`Processing renewal for subscription ${subscription.id}`);

    // Check if subscription should be renewed
    if (!subscription.autoRenew) {
      this.logger.log(`Subscription ${subscription.id} has auto-renew disabled, skipping`);
      await this.handleNonRenewingSubscription(subscription);
      return;
    }

    if (subscription.status !== SubscriptionStatus.ACTIVE) {
      this.logger.log(`Subscription ${subscription.id} is not active (status: ${subscription.status}), skipping`);
      return;
    }

    // Generate and charge invoice
    await this.generateAndChargeRenewalInvoice(subscription);
  }

  private async generateAndChargeRenewalInvoice(subscription: PatientSubscription): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Generate invoice number
      const result = await queryRunner.manager.query(`SELECT nextval('billing_invoice_seq') AS seq`);
      const seq = String(result[0].seq).padStart(8, '0');
      const invoiceNumber = `INV-${seq}`;

      // Create billing record
      const billing = queryRunner.manager.create(Billing, {
        invoiceNumber,
        patientId: subscription.patientId,
        patientName: subscription.patientName,
        serviceDate: new Date(),
        providerId: 'SYSTEM',
        providerName: 'Subscription Billing',
        totalCharges: subscription.currentPrice,
        balance: subscription.currentPrice,
        patientResponsibility: subscription.currentPrice,
        status: 'open',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        subscriptionId: subscription.id,
      });

      const savedBilling = await queryRunner.manager.save(Billing, billing);

      // Create line item
      const lineItem = queryRunner.manager.create(BillingLineItem, {
        billingId: savedBilling.id,
        lineNumber: 1,
        serviceDate: new Date(),
        cptCode: 'SUBS',
        cptDescription: `Subscription renewal - ${subscription.plan?.name || 'Subscription'}`,
        units: 1,
        unitCharge: subscription.currentPrice,
        totalCharge: subscription.currentPrice,
      });

      await queryRunner.manager.save(BillingLineItem, lineItem);

      // Create payment record
      const paymentNumber = `PAY-${Date.now()}-${uuidv4().substring(0, 4).toUpperCase()}`;
      const payment = queryRunner.manager.create(Payment, {
        paymentNumber,
        billingId: savedBilling.id,
        patientId: subscription.patientId,
        paymentMethod: PaymentMethod.PATIENT_PORTAL,
        status: PaymentStatus.PENDING,
        amount: subscription.currentPrice,
        paymentDate: new Date(),
        isPatientPayment: true,
        transactionId: uuidv4(),
      });

      await queryRunner.manager.save(Payment, payment);

      // Attempt to process payment (simulate payment gateway)
      const paymentSuccess = await this.simulatePaymentProcessing(payment, subscription);

      if (paymentSuccess) {
        // Update billing
        savedBilling.totalPayments = subscription.currentPrice;
        savedBilling.balance = 0;
        savedBilling.status = 'paid';
        await queryRunner.manager.save(Billing, savedBilling);

        // Update subscription
        await this.subscriptionService.resetFailedPaymentCount(subscription.id);
        await this.subscriptionService.updateNextBillingDate(subscription.id);
        subscription.lastPaymentDate = new Date();
        await queryRunner.manager.save(PatientSubscription, subscription);

        await queryRunner.commitTransaction();
        this.logger.log(`Successfully renewed subscription ${subscription.id}`);
      } else {
        await queryRunner.rollbackTransaction();

        // Handle failed payment
        await this.handleFailedPayment(subscription, payment);
      }
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async simulatePaymentProcessing(
    payment: Payment,
    subscription: PatientSubscription,
  ): Promise<boolean> {
    // In a real implementation, this would call a payment gateway (Stripe, PayPal, etc.)
    // For now, we'll simulate a 90% success rate
    const successRate = 0.9;
    const random = Math.random();

    if (random < successRate) {
      payment.status = PaymentStatus.COMPLETED;
      payment.postedDate = new Date();
      await this.paymentRepo.save(payment);
      return true;
    } else {
      payment.status = PaymentStatus.FAILED;
      payment.notes = 'Payment processing failed at gateway';
      await this.paymentRepo.save(payment);
      return false;
    }
  }

  private async handleFailedPayment(
    subscription: PatientSubscription,
    payment: Payment,
  ): Promise<void> {
    this.logger.warn(`Payment failed for subscription ${subscription.id}`);

    const updatedSubscription = await this.subscriptionService.incrementFailedPaymentCount(subscription.id);

    if (updatedSubscription.status === SubscriptionStatus.SUSPENDED) {
      this.logger.log(`Subscription ${subscription.id} suspended due to too many failed payments`);
    } else {
      this.logger.log(
        `Subscription ${subscription.id} marked as past due (${updatedSubscription.consecutiveFailedPayments}/${updatedSubscription.maxFailedPaymentsBeforeSuspension} failed payments)`,
      );
    }
  }

  private async handleNonRenewingSubscription(subscription: PatientSubscription): Promise<void> {
    subscription.status = SubscriptionStatus.CANCELLED;
    subscription.cancelledAt = new Date();
    subscription.cancellationReason = 'Auto-renew disabled';
    subscription.endDate = new Date();
    await this.subscriptionRepo.save(subscription);

    this.logger.log(`Cancelled non-renewing subscription ${subscription.id}`);
  }
}
