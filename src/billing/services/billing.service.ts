import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { Billing } from '../entities/billing.entity';
import { BillingLineItem } from '../entities/billing-line-item.entity';
import {
  CreateBillingDto,
  UpdateBillingDto,
  AddLineItemDto,
  UpdateLineItemDto,
} from '../dto/billing.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class BillingService {
  constructor(
    @InjectRepository(Billing)
    private readonly billingRepository: Repository<Billing>,
    @InjectRepository(BillingLineItem)
    private readonly lineItemRepository: Repository<BillingLineItem>,
  ) {}

  async create(createDto: CreateBillingDto): Promise<Billing> {
    const invoiceNumber = `INV-${Date.now()}-${uuidv4().substring(0, 4).toUpperCase()}`;

    let totalCharges = 0;
    const lineItems: BillingLineItem[] = [];

    createDto.lineItems.forEach((item, index) => {
      const units = item.units || 1;
      const totalCharge = item.unitCharge * units;
      totalCharges += totalCharge;

      const lineItem = this.lineItemRepository.create({
        lineNumber: index + 1,
        serviceDate: new Date(item.serviceDate),
        serviceDateEnd: item.serviceDateEnd ? new Date(item.serviceDateEnd) : undefined,
        cptCode: item.cptCode,
        cptDescription: item.cptDescription,
        modifiers: item.modifiers,
        diagnosisCodes: item.diagnosisCodes,
        units,
        unitCharge: item.unitCharge,
        totalCharge,
        revenueCode: item.revenueCode,
        ndc: item.ndc,
        notes: item.notes,
      });

      lineItems.push(lineItem);
    });

    const billing = this.billingRepository.create({
      invoiceNumber,
      patientId: createDto.patientId,
      patientName: createDto.patientName,
      encounterId: createDto.encounterId,
      serviceDate: new Date(createDto.serviceDate),
      providerId: createDto.providerId,
      providerName: createDto.providerName,
      providerNpi: createDto.providerNpi,
      facilityId: createDto.facilityId,
      facilityName: createDto.facilityName,
      placeOfService: createDto.placeOfService,
      totalCharges,
      balance: totalCharges,
      patientResponsibility: totalCharges,
      diagnosisCodes: createDto.diagnosisCodes,
      dueDate: createDto.dueDate ? new Date(createDto.dueDate) : undefined,
      notes: createDto.notes,
      lineItems,
    });

    return this.billingRepository.save(billing);
  }

  async findById(id: string): Promise<Billing> {
    const billing = await this.billingRepository.findOne({
      where: { id },
      relations: ['lineItems', 'payments'],
    });

    if (!billing) {
      throw new NotFoundException(`Billing with ID ${id} not found`);
    }

    return billing;
  }

  async findByInvoiceNumber(invoiceNumber: string): Promise<Billing> {
    const billing = await this.billingRepository.findOne({
      where: { invoiceNumber },
      relations: ['lineItems', 'payments'],
    });

    if (!billing) {
      throw new NotFoundException(`Billing with invoice ${invoiceNumber} not found`);
    }

    return billing;
  }

  async findByPatientId(
    patientId: string,
    options?: { page?: number; limit?: number },
  ): Promise<{ data: Billing[]; total: number }> {
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const skip = (page - 1) * limit;

    const [data, total] = await this.billingRepository.findAndCount({
      where: { patientId },
      relations: ['lineItems'],
      skip,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return { data, total };
  }

  async update(id: string, updateDto: UpdateBillingDto): Promise<Billing> {
    const billing = await this.findById(id);

    Object.assign(billing, {
      ...updateDto,
      dueDate: updateDto.dueDate ? new Date(updateDto.dueDate) : billing.dueDate,
    });

    return this.billingRepository.save(billing);
  }

  async addLineItem(billingId: string, lineItemDto: AddLineItemDto): Promise<BillingLineItem> {
    const billing = await this.findById(billingId);

    const maxLineNumber = billing.lineItems.reduce(
      (max, item) => Math.max(max, item.lineNumber),
      0,
    );

    const units = lineItemDto.units || 1;
    const totalCharge = lineItemDto.unitCharge * units;

    const lineItem = this.lineItemRepository.create({
      billingId,
      lineNumber: maxLineNumber + 1,
      serviceDate: new Date(lineItemDto.serviceDate),
      serviceDateEnd: lineItemDto.serviceDateEnd
        ? new Date(lineItemDto.serviceDateEnd)
        : undefined,
      cptCode: lineItemDto.cptCode,
      cptDescription: lineItemDto.cptDescription,
      modifiers: lineItemDto.modifiers,
      diagnosisCodes: lineItemDto.diagnosisCodes,
      units,
      unitCharge: lineItemDto.unitCharge,
      totalCharge,
      revenueCode: lineItemDto.revenueCode,
      ndc: lineItemDto.ndc,
      notes: lineItemDto.notes,
    });

    await this.lineItemRepository.save(lineItem);

    await this.recalculateTotals(billingId);

    return lineItem;
  }

  async updateLineItem(
    lineItemId: string,
    updateDto: UpdateLineItemDto,
  ): Promise<BillingLineItem> {
    const lineItem = await this.lineItemRepository.findOne({
      where: { id: lineItemId },
    });

    if (!lineItem) {
      throw new NotFoundException(`Line item with ID ${lineItemId} not found`);
    }

    Object.assign(lineItem, {
      ...updateDto,
      serviceDate: updateDto.serviceDate
        ? new Date(updateDto.serviceDate)
        : lineItem.serviceDate,
      serviceDateEnd: updateDto.serviceDateEnd
        ? new Date(updateDto.serviceDateEnd)
        : lineItem.serviceDateEnd,
    });

    if (updateDto.unitCharge !== undefined || updateDto.units !== undefined) {
      const units = updateDto.units ?? lineItem.units;
      const unitCharge = updateDto.unitCharge ?? lineItem.unitCharge;
      lineItem.totalCharge = units * unitCharge;
    }

    await this.lineItemRepository.save(lineItem);
    await this.recalculateTotals(lineItem.billingId);

    return lineItem;
  }

  async removeLineItem(lineItemId: string): Promise<void> {
    const lineItem = await this.lineItemRepository.findOne({
      where: { id: lineItemId },
    });

    if (!lineItem) {
      throw new NotFoundException(`Line item with ID ${lineItemId} not found`);
    }

    const billingId = lineItem.billingId;
    await this.lineItemRepository.remove(lineItem);
    await this.recalculateTotals(billingId);
  }

  async recalculateTotals(billingId: string): Promise<Billing> {
    const billing = await this.findById(billingId);

    const totalCharges = billing.lineItems.reduce(
      (sum, item) => sum + Number(item.totalCharge),
      0,
    );
    const totalAdjustments = billing.lineItems.reduce(
      (sum, item) => sum + Number(item.adjustmentAmount || 0),
      0,
    );
    const totalPayments = billing.payments?.reduce(
      (sum, payment) => sum + Number(payment.amount),
      0,
    ) || 0;

    billing.totalCharges = totalCharges;
    billing.totalAdjustments = totalAdjustments;
    billing.totalPayments = totalPayments;
    billing.balance = totalCharges - totalAdjustments - totalPayments;

    if (billing.balance <= 0) {
      billing.status = 'paid';
    } else if (totalPayments > 0) {
      billing.status = 'partial';
    }

    return this.billingRepository.save(billing);
  }

  async getOutstandingBalances(
    options?: { minBalance?: number; maxDays?: number },
  ): Promise<Billing[]> {
    const where: FindOptionsWhere<Billing> = {
      status: 'open',
    };

    let query = this.billingRepository
      .createQueryBuilder('billing')
      .leftJoinAndSelect('billing.lineItems', 'lineItems')
      .where('billing.balance > :minBalance', {
        minBalance: options?.minBalance || 0,
      });

    if (options?.maxDays) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - options.maxDays);
      query = query.andWhere('billing.serviceDate >= :cutoffDate', { cutoffDate });
    }

    return query.orderBy('billing.balance', 'DESC').getMany();
  }

  async markAsSentToCollections(id: string): Promise<Billing> {
    const billing = await this.findById(id);
    billing.isSentToCollections = true;
    billing.sentToCollectionsDate = new Date();
    billing.status = 'collections';
    return this.billingRepository.save(billing);
  }

  async getAgingReport(): Promise<{
    current: { count: number; total: number };
    days30: { count: number; total: number };
    days60: { count: number; total: number };
    days90: { count: number; total: number };
    days120Plus: { count: number; total: number };
  }> {
    const today = new Date();
    const day30 = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    const day60 = new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000);
    const day90 = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
    const day120 = new Date(today.getTime() - 120 * 24 * 60 * 60 * 1000);

    const calculateBucket = async (
      startDate: Date | null,
      endDate: Date,
    ): Promise<{ count: number; total: number }> => {
      const query = this.billingRepository
        .createQueryBuilder('billing')
        .where('billing.balance > 0');

      if (startDate) {
        query.andWhere('billing.serviceDate < :startDate', { startDate });
      }
      query.andWhere('billing.serviceDate >= :endDate', { endDate });

      const result = await query
        .select('COUNT(*)', 'count')
        .addSelect('SUM(billing.balance)', 'total')
        .getRawOne();

      return {
        count: parseInt(result.count) || 0,
        total: parseFloat(result.total) || 0,
      };
    };

    const [current, days30Result, days60Result, days90Result, days120Plus] =
      await Promise.all([
        calculateBucket(null, day30),
        calculateBucket(day30, day60),
        calculateBucket(day60, day90),
        calculateBucket(day90, day120),
        this.billingRepository
          .createQueryBuilder('billing')
          .where('billing.balance > 0')
          .andWhere('billing.serviceDate < :day120', { day120 })
          .select('COUNT(*)', 'count')
          .addSelect('SUM(billing.balance)', 'total')
          .getRawOne()
          .then((r) => ({
            count: parseInt(r?.count) || 0,
            total: parseFloat(r?.total) || 0,
          })),
      ]);

    return {
      current,
      days30: days30Result,
      days60: days60Result,
      days90: days90Result,
      days120Plus,
    };
  }
}
