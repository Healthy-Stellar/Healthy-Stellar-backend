import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Payment } from './entities/payment.entity';
import { Billing } from '../billing/entities/billing.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { RefundPaymentDto } from './dto/refund-payment.dto';

@Injectable()
export class PaymentService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Billing)
    private readonly billingRepository: Repository<Billing>,
    private readonly dataSource: DataSource,
  ) {}

  async processPayment(createPaymentDto: CreatePaymentDto): Promise<Payment> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const payment = queryRunner.manager.create(Payment, {
        ...createPaymentDto,
        status: 'completed',
        refundedAmount: 0,
      });
      await queryRunner.manager.save(payment);

      const billing = await queryRunner.manager.findOne(Billing, {
        where: { id: createPaymentDto.billingId },
      });

      if (!billing) {
        throw new NotFoundException('Billing record not found');
      }

      billing.totalPayments = Number(billing.totalPayments) + Number(payment.amount);
      billing.balance = Number(billing.balance) - Number(payment.amount);
      await queryRunner.manager.save(billing);

      await queryRunner.commitTransaction();
      return payment;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async refund(refundPaymentDto: RefundPaymentDto): Promise<Payment> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const originalPayment = await queryRunner.manager.findOne(Payment, {
        where: { id: refundPaymentDto.paymentId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!originalPayment) {
        throw new NotFoundException('Payment not found');
      }

      const refundedAmount = Number(originalPayment.refundedAmount) || 0;
      const maxRefundable = Number(originalPayment.amount) - refundedAmount;

      if (refundPaymentDto.amount > maxRefundable) {
        throw new BadRequestException(
          `Refund amount exceeds the maximum refundable amount of ${maxRefundable}`,
        );
      }

      const refundPayment = queryRunner.manager.create(Payment, {
        amount: refundPaymentDto.amount,
        status: 'refunded',
        billingId: originalPayment.billingId,
        originalPaymentId: originalPayment.id,
        refundedAmount: 0,
      });
      await queryRunner.manager.save(refundPayment);

      originalPayment.refundedAmount = refundedAmount + Number(refundPaymentDto.amount);
      await queryRunner.manager.save(originalPayment);

      const billing = await queryRunner.manager.findOne(Billing, {
        where: { id: originalPayment.billingId },
      });

      if (billing) {
        billing.totalPayments = Number(billing.totalPayments) - Number(refundPaymentDto.amount);
        billing.balance = Number(billing.balance) + Number(refundPaymentDto.amount);
        await queryRunner.manager.save(billing);
      }

      await queryRunner.commitTransaction();
      return refundPayment;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
