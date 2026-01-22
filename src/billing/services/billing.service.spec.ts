import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BillingService } from './billing.service';
import { Billing } from '../entities/billing.entity';
import { BillingLineItem } from '../entities/billing-line-item.entity';
import { NotFoundException } from '@nestjs/common';

describe('BillingService', () => {
  let service: BillingService;
  let billingRepository: Repository<Billing>;
  let lineItemRepository: Repository<BillingLineItem>;

  const mockBillingRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    findAndCount: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockLineItemRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
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

    service = module.get<BillingService>(BillingService);
    billingRepository = module.get<Repository<Billing>>(getRepositoryToken(Billing));
    lineItemRepository = module.get<Repository<BillingLineItem>>(
      getRepositoryToken(BillingLineItem),
    );
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto = {
      patientId: 'patient-123',
      patientName: 'John Doe',
      serviceDate: '2024-01-15',
      providerId: 'provider-123',
      providerName: 'Dr. Smith',
      diagnosisCodes: [{ code: 'J06.9', description: 'Upper respiratory infection', isPrimary: true }],
      lineItems: [
        {
          serviceDate: '2024-01-15',
          cptCode: '99213',
          cptDescription: 'Office visit',
          unitCharge: 150,
          units: 1,
        },
      ],
    };

    it('should create a new billing with line items', async () => {
      const mockBilling = {
        id: '1',
        invoiceNumber: 'INV-123',
        ...createDto,
        totalCharges: 150,
        balance: 150,
        lineItems: [],
      };

      mockLineItemRepository.create.mockReturnValue({});
      mockBillingRepository.create.mockReturnValue(mockBilling);
      mockBillingRepository.save.mockResolvedValue(mockBilling);

      const result = await service.create(createDto);

      expect(result).toBeDefined();
      expect(result.invoiceNumber).toContain('INV-');
      expect(mockBillingRepository.create).toHaveBeenCalled();
    });

    it('should calculate total charges correctly', async () => {
      const multiLineDto = {
        ...createDto,
        lineItems: [
          { serviceDate: '2024-01-15', cptCode: '99213', cptDescription: 'Office visit', unitCharge: 150, units: 1 },
          { serviceDate: '2024-01-15', cptCode: '36415', cptDescription: 'Blood draw', unitCharge: 25, units: 1 },
        ],
      };

      mockLineItemRepository.create.mockReturnValue({});
      mockBillingRepository.create.mockImplementation((data) => ({
        ...data,
        lineItems: [],
      }));
      mockBillingRepository.save.mockImplementation((billing) => Promise.resolve(billing));

      const result = await service.create(multiLineDto);

      expect(result.totalCharges).toBe(175);
    });
  });

  describe('findById', () => {
    it('should return a billing by ID', async () => {
      const mockBilling = {
        id: '1',
        invoiceNumber: 'INV-123',
        patientId: 'patient-123',
        lineItems: [],
        payments: [],
      };
      mockBillingRepository.findOne.mockResolvedValue(mockBilling);

      const result = await service.findById('1');

      expect(result).toEqual(mockBilling);
    });

    it('should throw NotFoundException if billing not found', async () => {
      mockBillingRepository.findOne.mockResolvedValue(null);

      await expect(service.findById('1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByInvoiceNumber', () => {
    it('should return a billing by invoice number', async () => {
      const mockBilling = {
        id: '1',
        invoiceNumber: 'INV-123',
        patientId: 'patient-123',
      };
      mockBillingRepository.findOne.mockResolvedValue(mockBilling);

      const result = await service.findByInvoiceNumber('INV-123');

      expect(result.invoiceNumber).toBe('INV-123');
    });
  });

  describe('findByPatientId', () => {
    it('should return paginated billings for a patient', async () => {
      const mockBillings = [
        { id: '1', patientId: 'patient-123' },
        { id: '2', patientId: 'patient-123' },
      ];
      mockBillingRepository.findAndCount.mockResolvedValue([mockBillings, 2]);

      const result = await service.findByPatientId('patient-123', { page: 1, limit: 20 });

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
    });
  });

  describe('addLineItem', () => {
    it('should add a line item to billing', async () => {
      const mockBilling = {
        id: '1',
        lineItems: [{ lineNumber: 1 }],
        payments: [],
        totalCharges: 150,
        totalAdjustments: 0,
        totalPayments: 0,
        balance: 150,
      };
      const newLineItem = {
        serviceDate: '2024-01-15',
        cptCode: '36415',
        cptDescription: 'Blood draw',
        unitCharge: 25,
        units: 1,
      };

      mockBillingRepository.findOne.mockResolvedValue(mockBilling);
      mockLineItemRepository.create.mockReturnValue({ ...newLineItem, lineNumber: 2 });
      mockLineItemRepository.save.mockResolvedValue({ ...newLineItem, lineNumber: 2 });
      mockBillingRepository.save.mockResolvedValue({
        ...mockBilling,
        totalCharges: 175,
        balance: 175,
      });

      const result = await service.addLineItem('1', newLineItem);

      expect(result.lineNumber).toBe(2);
    });
  });

  describe('updateLineItem', () => {
    it('should update a line item', async () => {
      const mockLineItem = {
        id: 'li-1',
        billingId: '1',
        unitCharge: 150,
        units: 1,
        totalCharge: 150,
        serviceDate: new Date(),
      };
      const mockBilling = {
        id: '1',
        lineItems: [mockLineItem],
        payments: [],
        totalCharges: 150,
        totalAdjustments: 0,
        totalPayments: 0,
        balance: 150,
      };

      mockLineItemRepository.findOne.mockResolvedValue(mockLineItem);
      mockLineItemRepository.save.mockResolvedValue({ ...mockLineItem, unitCharge: 175, totalCharge: 175 });
      mockBillingRepository.findOne.mockResolvedValue(mockBilling);
      mockBillingRepository.save.mockResolvedValue(mockBilling);

      const result = await service.updateLineItem('li-1', { unitCharge: 175 });

      expect(result.totalCharge).toBe(175);
    });
  });

  describe('removeLineItem', () => {
    it('should remove a line item', async () => {
      const mockLineItem = { id: 'li-1', billingId: '1' };
      const mockBilling = {
        id: '1',
        lineItems: [],
        payments: [],
        totalCharges: 0,
        totalAdjustments: 0,
        totalPayments: 0,
        balance: 0,
      };

      mockLineItemRepository.findOne.mockResolvedValue(mockLineItem);
      mockLineItemRepository.remove.mockResolvedValue(mockLineItem);
      mockBillingRepository.findOne.mockResolvedValue(mockBilling);
      mockBillingRepository.save.mockResolvedValue(mockBilling);

      await service.removeLineItem('li-1');

      expect(mockLineItemRepository.remove).toHaveBeenCalledWith(mockLineItem);
    });
  });

  describe('recalculateTotals', () => {
    it('should recalculate billing totals', async () => {
      const mockBilling = {
        id: '1',
        lineItems: [
          { totalCharge: 100, adjustmentAmount: 10 },
          { totalCharge: 50, adjustmentAmount: 5 },
        ],
        payments: [{ amount: 50 }],
        totalCharges: 0,
        totalAdjustments: 0,
        totalPayments: 0,
        balance: 0,
        status: 'open',
      };

      mockBillingRepository.findOne.mockResolvedValue(mockBilling);
      mockBillingRepository.save.mockImplementation((billing) => Promise.resolve(billing));

      const result = await service.recalculateTotals('1');

      expect(result.totalCharges).toBe(150);
      expect(result.totalAdjustments).toBe(15);
      expect(result.totalPayments).toBe(50);
      expect(result.balance).toBe(85);
    });
  });

  describe('markAsSentToCollections', () => {
    it('should mark billing as sent to collections', async () => {
      const mockBilling = {
        id: '1',
        isSentToCollections: false,
        status: 'open',
        lineItems: [],
        payments: [],
      };

      mockBillingRepository.findOne.mockResolvedValue(mockBilling);
      mockBillingRepository.save.mockResolvedValue({
        ...mockBilling,
        isSentToCollections: true,
        status: 'collections',
      });

      const result = await service.markAsSentToCollections('1');

      expect(result.isSentToCollections).toBe(true);
      expect(result.status).toBe('collections');
    });
  });
});
