import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentService } from './payment.service';
import { Payment } from '../entities/payment.entity';
import { Billing } from '../entities/billing.entity';
import { BillingLineItem } from '../entities/billing-line-item.entity';
import { PaymentStatus, PaymentMethod } from '../../common/enums';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('PaymentService', () => {
  let service: PaymentService;
  let paymentRepository: Repository<Payment>;
  let billingRepository: Repository<Billing>;
  let lineItemRepository: Repository<BillingLineItem>;

  const mockPaymentRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    findAndCount: jest.fn(),
  };

  const mockBillingRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockLineItemRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        {
          provide: getRepositoryToken(Payment),
          useValue: mockPaymentRepository,
        },
        {
          provide: getRepositoryToken(Billing),
          useValue: mockBillingRepository,
        },
        {
          provide: getRepositoryToken(BillingLineItem),
          useValue: mockLineItemRepository,
        },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
    paymentRepository = module.get<Repository<Payment>>(getRepositoryToken(Payment));
    billingRepository = module.get<Repository<Billing>>(getRepositoryToken(Billing));
    lineItemRepository = module.get<Repository<BillingLineItem>>(getRepositoryToken(BillingLineItem));
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto = {
      billingId: 'billing-123',
      patientId: 'patient-123',
      paymentMethod: PaymentMethod.CREDIT_CARD,
      amount: 100,
      paymentDate: '2024-01-15',
      isPatientPayment: true,
    };

    it('should create and process a payment', async () => {
      const mockBilling = {
        id: 'billing-123',
        balance: 150,
        totalPayments: 0,
        lineItems: [],
        payments: [],
        status: 'open',
      };
      const mockPayment = {
        id: 'pay-1',
        paymentNumber: 'PAY-123',
        ...createDto,
        billingId: 'billing-123',
        status: PaymentStatus.PENDING,
      };
      const processedPayment = { ...mockPayment, status: PaymentStatus.COMPLETED, postedDate: new Date() };

      mockBillingRepository.findOne.mockResolvedValue(mockBilling);
      mockPaymentRepository.create.mockReturnValue(mockPayment);
      mockPaymentRepository.save.mockResolvedValue(processedPayment);
      mockPaymentRepository.findOne.mockResolvedValue(mockPayment);
      mockBillingRepository.save.mockResolvedValue({
        ...mockBilling,
        totalPayments: 100,
        balance: 50,
      });

      const result = await service.create(createDto);

      expect(result.paymentNumber).toContain('PAY-');
    });

    it('should throw BadRequestException if amount exceeds balance', async () => {
      const mockBilling = { id: 'billing-123', balance: 50 };
      mockBillingRepository.findOne.mockResolvedValue(mockBilling);

      await expect(service.create({ ...createDto, amount: 100 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException if billing not found', async () => {
      mockBillingRepository.findOne.mockResolvedValue(null);

      await expect(service.create(createDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findById', () => {
    it('should return a payment by ID', async () => {
      const mockPayment = {
        id: 'pay-1',
        paymentNumber: 'PAY-123',
        amount: 100,
      };
      mockPaymentRepository.findOne.mockResolvedValue(mockPayment);

      const result = await service.findById('pay-1');

      expect(result).toEqual(mockPayment);
    });

    it('should throw NotFoundException if payment not found', async () => {
      mockPaymentRepository.findOne.mockResolvedValue(null);

      await expect(service.findById('pay-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('search', () => {
    it('should return paginated payments', async () => {
      const mockPayments = [
        { id: 'pay-1', paymentNumber: 'PAY-001' },
        { id: 'pay-2', paymentNumber: 'PAY-002' },
      ];
      mockPaymentRepository.findAndCount.mockResolvedValue([mockPayments, 2]);

      const result = await service.search({ page: 1, limit: 20 });

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should filter by payment method', async () => {
      mockPaymentRepository.findAndCount.mockResolvedValue([[], 0]);

      await service.search({ paymentMethod: PaymentMethod.CHECK });

      expect(mockPaymentRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ paymentMethod: PaymentMethod.CHECK }),
        }),
      );
    });
  });

  describe('refund', () => {
    it('should process a refund', async () => {
      const originalPayment = {
        id: 'pay-1',
        paymentNumber: 'PAY-123',
        billingId: 'billing-123',
        patientId: 'patient-123',
        amount: 100,
        refundedAmount: 0,
        status: PaymentStatus.COMPLETED,
        paymentMethod: PaymentMethod.CREDIT_CARD,
        isPatientPayment: true,
        isInsurancePayment: false,
      };
      const mockBilling = {
        id: 'billing-123',
        totalPayments: 100,
        balance: 50,
        status: 'partial',
      };
      const refundPayment = {
        paymentNumber: 'REF-123',
        billingId: 'billing-123',
        patientId: 'patient-123',
        paymentMethod: PaymentMethod.CREDIT_CARD,
        status: PaymentStatus.COMPLETED,
        amount: -50,
        paymentDate: new Date(),
        postedDate: new Date(),
        isPatientPayment: true,
        isInsurancePayment: false,
        notes: 'Refund for payment PAY-123: Patient request',
      };

      mockPaymentRepository.findOne.mockResolvedValue(originalPayment);
      mockPaymentRepository.create.mockReturnValue(refundPayment);
      mockPaymentRepository.save.mockImplementation((payment) => Promise.resolve(payment));
      mockBillingRepository.findOne.mockResolvedValue(mockBilling);
      mockBillingRepository.save.mockResolvedValue(mockBilling);

      const result = await service.refund({
        paymentId: 'pay-1',
        refundAmount: 50,
        reason: 'Patient request',
      });

      expect(result.amount).toBe(-50);
    });

    it('should throw BadRequestException if refund exceeds payment', async () => {
      const originalPayment = {
        id: 'pay-1',
        amount: 100,
        refundedAmount: 75,
        status: PaymentStatus.COMPLETED,
      };
      mockPaymentRepository.findOne.mockResolvedValue(originalPayment);

      await expect(
        service.refund({ paymentId: 'pay-1', refundAmount: 50, reason: 'test' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for non-completed payment', async () => {
      const originalPayment = {
        id: 'pay-1',
        status: PaymentStatus.PENDING,
      };
      mockPaymentRepository.findOne.mockResolvedValue(originalPayment);

      await expect(
        service.refund({ paymentId: 'pay-1', refundAmount: 50, reason: 'test' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getPaymentsByBilling', () => {
    it('should return payments for a billing', async () => {
      const mockPayments = [
        { id: 'pay-1', billingId: 'billing-123' },
        { id: 'pay-2', billingId: 'billing-123' },
      ];
      mockPaymentRepository.find.mockResolvedValue(mockPayments);

      const result = await service.getPaymentsByBilling('billing-123');

      expect(result).toHaveLength(2);
    });
  });

  describe('getDailyPaymentSummary', () => {
    it('should return daily summary', async () => {
      const mockPayments = [
        {
          id: 'pay-1',
          amount: 100,
          paymentMethod: PaymentMethod.CREDIT_CARD,
          isPatientPayment: true,
          isInsurancePayment: false,
        },
        {
          id: 'pay-2',
          amount: 500,
          paymentMethod: PaymentMethod.INSURANCE,
          isPatientPayment: false,
          isInsurancePayment: true,
        },
      ];
      mockPaymentRepository.find.mockResolvedValue(mockPayments);

      const result = await service.getDailyPaymentSummary(new Date());

      expect(result.totalPayments).toBe(2);
      expect(result.totalAmount).toBe(600);
      expect(result.patientPayments.count).toBe(1);
      expect(result.insurancePayments.count).toBe(1);
    });
  });
});
