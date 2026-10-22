import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LabOrder } from '../entities/lab-order.entity';
import { Specimen } from '../entities/specimen.entity';
import { LabResult } from '../entities/lab-result.entity';

@Injectable()
export class LaboratoryService {
  constructor(
    @InjectRepository(LabOrder)
    private readonly orderRepo: Repository<LabOrder>,
    @InjectRepository(Specimen)
    private readonly specimenRepo: Repository<Specimen>,
    @InjectRepository(LabResult)
    private readonly resultRepo: Repository<LabResult>,
  ) {}

  private async generateOrderNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `LAB-${year}-`;
    const latest = await this.orderRepo.findOne({
      where: {},
      order: { createdAt: 'DESC' },
    });
    let seq = 1;
    if (latest?.orderNumber?.startsWith(prefix)) {
      const n = parseInt(latest.orderNumber.replace(prefix, ''), 10);
      if (!isNaN(n)) seq = n + 1;
    }
    return `${prefix}${String(seq).padStart(4, '0')}`;
  }

  async createOrder(dto: Partial<LabOrder>): Promise<LabOrder> {
    const orderNumber = await this.generateOrderNumber();
    const order = this.orderRepo.create({ ...dto, orderNumber } as LabOrder);
    return this.orderRepo.save(order);
  }

  async trackSpecimen(id: string): Promise<Specimen> {
    const specimen = await this.specimenRepo.findOne({ where: { id } });
    if (!specimen) throw new NotFoundException(`Specimen ${id} not found.`);
    return specimen;
  }

  async recordResult(dto: Partial<LabResult>): Promise<LabResult> {
    if (dto.orderId) {
      const order = await this.orderRepo.findOne({ where: { id: dto.orderId } });
      if (!order) throw new NotFoundException(`Order ${dto.orderId} not found.`);
    }
    const result = this.resultRepo.create(dto as LabResult);
    return this.resultRepo.save(result);
  }
}
