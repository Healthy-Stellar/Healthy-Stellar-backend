import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TelehealthBillingService } from './Telehealth billing.service';
import { TelehealthBilling, BillingStatus } from '../entity/Telehealth billing.entity';

describe('TelehealthBillingService', () => {
  it('keeps amountPaid and balanceDue numeric across two partial payments', async () => {
    const billing = {
      id: 'billing-1',
      amountPaid: '0.00',
      balanceDue: '100.00',
      status: BillingStatus.PENDING,
      paymentHistory: [],
    } as TelehealthBilling;

    let current = { ...billing };

    const repo = {
      findOne: jest.fn().mockImplementation(async ({ where }) => {
        if (where.id === 'billing-1') {
          return { ...current };
        }
        return null;
      }),
      save: jest.fn().mockImplementation(async (record) => {
        current = { ...record };
        return current;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelehealthBillingService,
        { provide: getRepositoryToken(TelehealthBilling), useValue: repo },
      ],
    }).compile();

    const service = module.get(TelehealthBillingService);

    const first = await service.recordPayment('billing-1', 40, 'card', 'patient', 'txn-1');
    const second = await service.recordPayment('billing-1', 60, 'card', 'patient', 'txn-2');

    expect(Number(first.amountPaid)).toBe(40);
    expect(Number(first.balanceDue)).toBe(60);
    expect(first.status).toBe(BillingStatus.PARTIALLY_PAID);
    expect(Number(second.amountPaid)).toBe(100);
    expect(Number(second.balanceDue)).toBe(0);
    expect(second.status).toBe(BillingStatus.PAID);
  });
});
