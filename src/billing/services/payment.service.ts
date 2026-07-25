import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, Between } from 'typeorm';
import { Payment } from '../entities/payment.entity';
import { Billing } from '../entities/billing.entity';
import { BillingLineItem } from '../entities/billing-line-item.entity';
import {
  CreatePaymentDto,
  UpdatePaymentDto,
  RefundPaymentDto,
  PaymentSearchDto,
} from '../dto/payment.dto';
import { PaymentStatus, PaymentMethod } from '../../common/enums';
import { v4 as uuidv4 } from 'uuid';
import { InvoicePdfService } from './invoice-pdf.service';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Billing)
    private readonly billingRepository: Repository<Billing>,
    @InjectRepository(BillingLineItem)
    private readonly lineItemRepository: Repository<BillingLineItem>,
    private readonly invoicePdfService: InvoicePdfService,
  ) {}

  async create(createDto: CreatePaymentDto): Promise<Payment> {
    const billing = await this.billingRepository.findOne({
      where: { id: createDto.billingId },
      relations: ['lineItems'],
    });

    if (!billing) {
      throw new NotFoundException(`Billing with ID ${createDto.billingId} not found`);
    }

    if (createDto.amount > billing.balance) {
      throw new BadRequestException(
        `Payment amount ($${createDto.amount}) exceeds outstanding balance ($${billing.balance})`,
      );
    }

    // Idempotency: a client-supplied transactionId identifies a single
    // logical payment attempt (e.g. a gateway charge). If a payment already
    // exists for it, return that payment instead of creating a second
    // Payment row and a second deduction from billing.balance.
    if (createDto.transactionId) {
      const existingPayment = await this.paymentRepository.findOne({
        where: { transactionId: createDto.transactionId },
      });
      if (existingPayment) {
        this.logger.warn(
          `Duplicate payment request for transactionId=${createDto.transactionId}; returning existing payment ${existingPayment.id}`,
        );
        return existingPayment;
      }
    }

    const paymentNumber = `PAY-${Date.now()}-${uuidv4().substring(0, 4).toUpperCase()}`;

    const payment = this.paymentRepository.create({
      paymentNumber,
      billingId: createDto.billingId,
      claimId: createDto.claimId,
      patientId: createDto.patientId,
      paymentMethod: createDto.paymentMethod,
      status: PaymentStatus.PENDING,
      amount: createDto.amount,
      paymentDate: new Date(createDto.paymentDate),
      payerName: createDto.payerName,
      payerId: createDto.payerId,
      checkNumber: createDto.checkNumber,
      transactionId: createDto.transactionId || uuidv4(),
      eraNumber: createDto.eraNumber,
      isPatientPayment: createDto.isPatientPayment || false,
      isInsurancePayment: createDto.isInsurancePayment || false,
      paymentAllocation: createDto.paymentAllocation,
      cardDetails: createDto.cardDetails,
      achDetails: createDto.achDetails,
      notes: createDto.notes,
    });

    try {
      await this.paymentRepository.save(payment);
    } catch (error) {
      // A concurrent request carrying the same client-supplied transactionId
      // may have won the race to insert first. The unique constraint on
      // transactionId (see migration AddUniqueConstraintToPaymentTransactionId)
      // turns that race into "return the existing payment" instead of a
      // duplicate deduction against billing.balance.
      if (createDto.transactionId && this.isDuplicateKeyError(error)) {
        const existingPayment = await this.paymentRepository.findOne({
          where: { transactionId: createDto.transactionId },
        });
        if (existingPayment) {
          return existingPayment;
        }
      }
      throw error;
    }

    const processedPayment = await this.processPayment(payment.id);

    return processedPayment;
  }

  private isDuplicateKeyError(error: unknown): boolean {
    const code = (error as { code?: string } | undefined)?.code;
    return code === '23505';
  }

  async processPayment(paymentId: string): Promise<Payment> {
    const payment = await this.findById(paymentId);

    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException(`Payment is already in ${payment.status} status`);
    }

    payment.status = PaymentStatus.PROCESSING;
    await this.paymentRepository.save(payment);

    try {
      if (payment.paymentAllocation && payment.paymentAllocation.length > 0) {
        for (const allocation of payment.paymentAllocation) {
          const lineItem = await this.lineItemRepository.findOne({
            where: { id: allocation.lineItemId },
          });

          if (lineItem) {
            lineItem.paidAmount = Number(lineItem.paidAmount) + allocation.amount;
            if (allocation.adjustmentAmount) {
              lineItem.adjustmentAmount =
                Number(lineItem.adjustmentAmount) + allocation.adjustmentAmount;
            }
            await this.lineItemRepository.save(lineItem);
          }
        }
      }

      // Lock the billing row for the duration of the balance mutation so
      // concurrent payments against the same billing record serialize
      // instead of both reading a stale balance and both applying their
      // deduction. The balance is re-validated under the lock — rather than
      // clamping a negative result to zero — so a payment that no longer
      // fits (because a concurrent payment already consumed the balance) is
      // rejected instead of silently driving the balance negative.
      await this.billingRepository.manager.transaction(async (manager) => {
        const billing = await manager
          .createQueryBuilder(Billing, 'billing')
          .setLock('pessimistic_write')
          .where('billing.id = :id', { id: payment.billingId })
          .getOne();

        if (!billing) {
          return;
        }

        const paymentAmount = Number(payment.amount);
        const currentBalance = Number(billing.balance);

        if (paymentAmount > currentBalance) {
          throw new BadRequestException(
            `Payment amount ($${paymentAmount}) exceeds outstanding balance ($${currentBalance})`,
          );
        }

        billing.totalPayments = Number(billing.totalPayments) + paymentAmount;
        billing.balance = currentBalance - paymentAmount;

        if (payment.isInsurancePayment) {
          billing.insuranceResponsibility =
            Number(billing.insuranceResponsibility || 0) - paymentAmount;
        } else {
          billing.patientResponsibility =
            Number(billing.patientResponsibility || 0) - paymentAmount;
        }

        billing.status = billing.balance <= 0 ? 'paid' : 'partial';

        await manager.save(Billing, billing);
      });

      payment.status = PaymentStatus.COMPLETED;
      payment.postedDate = new Date();
      await this.paymentRepository.save(payment);

      // Emit a patient-facing invoice PDF email once the payment is confirmed.
      // Best-effort: failures here must not roll back a successful payment.
      this.invoicePdfService.sendInvoiceEmail(payment.billingId).catch((error) => {
        this.logger.warn(
          `Failed to send invoice email for billing ${payment.billingId}: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
        );
      });

      return payment;
    } catch (error) {
      payment.status = PaymentStatus.FAILED;
      payment.notes = `${payment.notes || ''}\nProcessing failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      await this.paymentRepository.save(payment);
      throw error;
    }
  }

  async findById(id: string): Promise<Payment> {
    const payment = await this.paymentRepository.findOne({
      where: { id },
      relations: ['billing'],
    });

    if (!payment) {
      throw new NotFoundException(`Payment with ID ${id} not found`);
    }

    return payment;
  }

  async findByPaymentNumber(paymentNumber: string): Promise<Payment> {
    const payment = await this.paymentRepository.findOne({
      where: { paymentNumber },
      relations: ['billing'],
    });

    if (!payment) {
      throw new NotFoundException(`Payment with number ${paymentNumber} not found`);
    }

    return payment;
  }

  async search(searchDto: PaymentSearchDto): Promise<{
    data: Payment[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page = 1, limit = 20, ...filters } = searchDto;
    const skip = (page - 1) * limit;

    const where: FindOptionsWhere<Payment> = {};

    if (filters.patientId) {
      where.patientId = filters.patientId;
    }

    if (filters.billingId) {
      where.billingId = filters.billingId;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.paymentMethod) {
      where.paymentMethod = filters.paymentMethod;
    }

    if (filters.isPatientPayment !== undefined) {
      where.isPatientPayment = filters.isPatientPayment;
    }

    if (filters.isInsurancePayment !== undefined) {
      where.isInsurancePayment = filters.isInsurancePayment;
    }

    if (filters.startDate && filters.endDate) {
      where.paymentDate = Between(new Date(filters.startDate), new Date(filters.endDate));
    }

    const [data, total] = await this.paymentRepository.findAndCount({
      where,
      relations: ['billing'],
      skip,
      take: limit,
      order: { paymentDate: 'DESC' },
    });

    return { data, total, page, limit };
  }

  async update(id: string, updateDto: UpdatePaymentDto): Promise<Payment> {
    const payment = await this.findById(id);

    if (payment.status === PaymentStatus.COMPLETED) {
      throw new BadRequestException('Cannot update a completed payment');
    }

    Object.assign(payment, {
      ...updateDto,
      postedDate: updateDto.postedDate ? new Date(updateDto.postedDate) : payment.postedDate,
    });

    return this.paymentRepository.save(payment);
  }

  async refund(refundDto: RefundPaymentDto): Promise<Payment> {
    const originalPayment = await this.findById(refundDto.paymentId);

    if (originalPayment.status !== PaymentStatus.COMPLETED) {
      throw new BadRequestException('Can only refund completed payments');
    }

    const maxRefundable = Number(originalPayment.amount) - Number(originalPayment.refundedAmount);

    if (refundDto.refundAmount > maxRefundable) {
      throw new BadRequestException(
        `Refund amount ($${refundDto.refundAmount}) exceeds available amount ($${maxRefundable})`,
      );
    }

    const refundPaymentNumber = `REF-${Date.now()}-${uuidv4().substring(0, 4).toUpperCase()}`;

    const refundPayment = this.paymentRepository.create({
      paymentNumber: refundPaymentNumber,
      billingId: originalPayment.billingId,
      patientId: originalPayment.patientId,
      paymentMethod: originalPayment.paymentMethod,
      status: PaymentStatus.COMPLETED,
      amount: -refundDto.refundAmount,
      paymentDate: new Date(),
      postedDate: new Date(),
      isPatientPayment: originalPayment.isPatientPayment,
      isInsurancePayment: originalPayment.isInsurancePayment,
      notes: `Refund for payment ${originalPayment.paymentNumber}: ${refundDto.reason}`,
    });

    await this.paymentRepository.save(refundPayment);

    originalPayment.refundedAmount =
      Number(originalPayment.refundedAmount) + refundDto.refundAmount;

    if (originalPayment.refundedAmount >= originalPayment.amount) {
      originalPayment.status = PaymentStatus.REFUNDED;
    } else {
      originalPayment.status = PaymentStatus.PARTIALLY_REFUNDED;
    }

    await this.paymentRepository.save(originalPayment);

    const billing = await this.billingRepository.findOne({
      where: { id: originalPayment.billingId },
    });

    if (billing) {
      billing.totalPayments = Number(billing.totalPayments) - refundDto.refundAmount;
      billing.balance = Number(billing.balance) + refundDto.refundAmount;

      if (billing.balance > 0) {
        billing.status = billing.totalPayments > 0 ? 'partial' : 'open';
      }

      await this.billingRepository.save(billing);
    }

    return refundPayment;
  }

  async getPaymentsByBilling(billingId: string): Promise<Payment[]> {
    return this.paymentRepository.find({
      where: { billingId },
      order: { paymentDate: 'DESC' },
    });
  }

  async getPaymentsByPatient(
    patientId: string,
    options?: { startDate?: Date; endDate?: Date },
  ): Promise<Payment[]> {
    const where: FindOptionsWhere<Payment> = { patientId };

    if (options?.startDate && options?.endDate) {
      where.paymentDate = Between(options.startDate, options.endDate);
    }

    return this.paymentRepository.find({
      where,
      relations: ['billing'],
      order: { paymentDate: 'DESC' },
    });
  }

  async getDailyPaymentSummary(date: Date): Promise<{
    totalPayments: number;
    totalAmount: number;
    byMethod: Record<string, { count: number; amount: number }>;
    patientPayments: { count: number; amount: number };
    insurancePayments: { count: number; amount: number };
  }> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const payments = await this.paymentRepository.find({
      where: {
        paymentDate: Between(startOfDay, endOfDay),
        status: PaymentStatus.COMPLETED,
      },
    });

    const byMethod: Record<string, { count: number; amount: number }> = {};
    let patientCount = 0;
    let patientAmount = 0;
    let insuranceCount = 0;
    let insuranceAmount = 0;

    for (const payment of payments) {
      const method = payment.paymentMethod;
      if (!byMethod[method]) {
        byMethod[method] = { count: 0, amount: 0 };
      }
      byMethod[method].count += 1;
      byMethod[method].amount += Number(payment.amount);

      if (payment.isPatientPayment) {
        patientCount += 1;
        patientAmount += Number(payment.amount);
      }

      if (payment.isInsurancePayment) {
        insuranceCount += 1;
        insuranceAmount += Number(payment.amount);
      }
    }

    return {
      totalPayments: payments.length,
      totalAmount: payments.reduce((sum, p) => sum + Number(p.amount), 0),
      byMethod,
      patientPayments: { count: patientCount, amount: patientAmount },
      insurancePayments: { count: insuranceCount, amount: insuranceAmount },
    };
  }
}
