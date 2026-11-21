import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TelehealthBilling } from './telehealth-billing.entity';

@Injectable()
export class TelehealthBillingService {
  constructor(
    @InjectRepository(TelehealthBilling)
    private readonly billingRepository: Repository<TelehealthBilling>,
  ) {}

  async createBilling(data: Partial<TelehealthBilling>): Promise<TelehealthBilling> {
    const billing = this.billingRepository.create(data);
    return this.billingRepository.save(billing);
  }

  async findById(id: string): Promise<TelehealthBilling> {
    const billing = await this.billingRepository.findOne({ where: { id } });
    if (!billing) {
      throw new NotFoundException(`Billing record ${id} not found`);
    }
    return billing;
  }

  async findByPatient(patientId: string): Promise<TelehealthBilling[]> {
    return this.billingRepository.find({ where: { patientId } });
  }

  async recordPayment(id: string, amount: number): Promise<TelehealthBilling> {
    if (amount <= 0) {
      throw new BadRequestException('Payment amount must be greater than zero');
    }

    const billing = await this.findById(id);

    // TypeORM returns `decimal`/`numeric` columns as strings to avoid float
    // precision loss. Coerce to numbers before doing arithmetic so we don't
    // accidentally perform string concatenation (e.g. "0.00" + 50 -> "0.0050").
    const currentAmountPaid = Number(billing.amountPaid);
    const currentBalanceDue = Number(billing.balanceDue);

    billing.amountPaid = currentAmountPaid + amount;
    billing.balanceDue = currentBalanceDue - amount;

    return this.billingRepository.save(billing);
  }
}
