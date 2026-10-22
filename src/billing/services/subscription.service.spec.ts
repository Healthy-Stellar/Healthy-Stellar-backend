import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { SubscriptionPlan } from '../entities/subscription-plan.entity';
import { PatientSubscription } from '../entities/patient-subscription.entity';
import { Billing } from '../entities/billing.entity';
import { SubscriptionStatus, SubscriptionCadence } from '../../common/enums';
import {
  CreateSubscriptionPlanDto,
  CreatePatientSubscriptionDto,
  ChangeSubscriptionPlanDto,
} from '../dto/subscription.dto';

describe('SubscriptionService', () => {
  let service: SubscriptionService;
  let planRepo: Repository<SubscriptionPlan>;
  let subscriptionRepo: Repository<PatientSubscription>;
  let billingRepo: Repository<Billing>;

  const mockPlanRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    count: jest.fn(),
    remove: jest.fn(),
  };

  const mockSubscriptionRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
    findAndCount: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockBillingRepo = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionService,
        {
          provide: getRepositoryToken(SubscriptionPlan),
          useValue: mockPlanRepo,
        },
        {
          provide: getRepositoryToken(PatientSubscription),
          useValue: mockSubscriptionRepo,
        },
        {
          provide: getRepositoryToken(Billing),
          useValue: mockBillingRepo,
        },
      ],
    }).compile();

    service = module.get<SubscriptionService>(SubscriptionService);
    planRepo = module.get<Repository<SubscriptionPlan>>(getRepositoryToken(SubscriptionPlan));
    subscriptionRepo = module.get<Repository<PatientSubscription>>(
      getRepositoryToken(PatientSubscription),
    );
    billingRepo = module.get<Repository<Billing>>(getRepositoryToken(Billing));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createPlan', () => {
    it('should create a new subscription plan', async () => {
      const createDto: CreateSubscriptionPlanDto = {
        name: 'Basic Plan',
        cadence: SubscriptionCadence.MONTHLY,
        price: 29.99,
        currency: 'USD',
        includedServices: [{ serviceType: 'telemedicine', quantity: 10 }],
      };

      const expectedPlan = { id: 'plan-1', ...createDto };
      mockPlanRepo.findOne.mockResolvedValue(null);
      mockPlanRepo.create.mockReturnValue(expectedPlan);
      mockPlanRepo.save.mockResolvedValue(expectedPlan);

      const result = await service.createPlan(createDto);

      expect(result).toEqual(expectedPlan);
      expect(mockPlanRepo.findOne).toHaveBeenCalledWith({ where: { name: createDto.name } });
      expect(mockPlanRepo.create).toHaveBeenCalledWith({
        ...createDto,
        currency: 'USD',
        trialPeriodDays: 0,
        isActive: true,
      });
    });

    it('should throw BadRequestException if plan name already exists', async () => {
      const createDto: CreateSubscriptionPlanDto = {
        name: 'Basic Plan',
        cadence: SubscriptionCadence.MONTHLY,
        price: 29.99,
      };

      mockPlanRepo.findOne.mockResolvedValue({ id: 'existing-plan' });

      await expect(service.createPlan(createDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('createSubscription', () => {
    it('should create a new patient subscription', async () => {
      const createDto: CreatePatientSubscriptionDto = {
        patientId: 'patient-1',
        patientName: 'John Doe',
        planId: 'plan-1',
        startDate: '2024-01-01',
      };

      const mockPlan = {
        id: 'plan-1',
        name: 'Basic Plan',
        cadence: SubscriptionCadence.MONTHLY,
        price: 29.99,
        currency: 'USD',
        isActive: true,
      };

      const expectedSubscription = {
        id: 'sub-1',
        ...createDto,
        status: SubscriptionStatus.ACTIVE,
      };

      mockPlanRepo.findOne.mockResolvedValue(mockPlan);
      mockSubscriptionRepo.findOne.mockResolvedValue(null);
      mockSubscriptionRepo.create.mockReturnValue(expectedSubscription);
      mockSubscriptionRepo.save.mockResolvedValue(expectedSubscription);

      const result = await service.createSubscription(createDto);

      expect(result).toEqual(expectedSubscription);
      expect(mockPlanRepo.findOne).toHaveBeenCalledWith({ where: { id: createDto.planId } });
    });

    it('should throw BadRequestException if plan is not active', async () => {
      const createDto: CreatePatientSubscriptionDto = {
        patientId: 'patient-1',
        patientName: 'John Doe',
        planId: 'plan-1',
        startDate: '2024-01-01',
      };

      const mockPlan = {
        id: 'plan-1',
        name: 'Basic Plan',
        isActive: false,
      };

      mockPlanRepo.findOne.mockResolvedValue(mockPlan);

      await expect(service.createSubscription(createDto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if patient already has active subscription', async () => {
      const createDto: CreatePatientSubscriptionDto = {
        patientId: 'patient-1',
        patientName: 'John Doe',
        planId: 'plan-1',
        startDate: '2024-01-01',
      };

      const mockPlan = {
        id: 'plan-1',
        name: 'Basic Plan',
        isActive: true,
      };

      mockPlanRepo.findOne.mockResolvedValue(mockPlan);
      mockSubscriptionRepo.findOne.mockResolvedValue({ id: 'existing-sub' });

      await expect(service.createSubscription(createDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('changeSubscriptionPlan', () => {
    it('should change subscription plan successfully', async () => {
      const subscriptionId = 'sub-1';
      const changeDto: ChangeSubscriptionPlanDto = {
        newPlanId: 'plan-2',
        prorate: true,
      };

      const mockSubscription = {
        id: subscriptionId,
        patientId: 'patient-1',
        planId: 'plan-1',
        status: SubscriptionStatus.ACTIVE,
      };

      const mockNewPlan = {
        id: 'plan-2',
        name: 'Premium Plan',
        cadence: SubscriptionCadence.MONTHLY,
        price: 49.99,
        currency: 'USD',
        isActive: true,
      };

      const updatedSubscription = {
        ...mockSubscription,
        planId: 'plan-2',
        currentPrice: 49.99,
      };

      mockSubscriptionRepo.findOne.mockResolvedValue(mockSubscription);
      mockPlanRepo.findOne.mockResolvedValue(mockNewPlan);
      mockSubscriptionRepo.save.mockResolvedValue(updatedSubscription);

      const result = await service.changeSubscriptionPlan(subscriptionId, changeDto);

      expect(result.planId).toBe('plan-2');
      expect(result.currentPrice).toBe(49.99);
    });

    it('should throw BadRequestException if new plan is not active', async () => {
      const subscriptionId = 'sub-1';
      const changeDto: ChangeSubscriptionPlanDto = {
        newPlanId: 'plan-2',
      };

      const mockSubscription = { id: subscriptionId };
      const mockNewPlan = { id: 'plan-2', isActive: false };

      mockSubscriptionRepo.findOne.mockResolvedValue(mockSubscription);
      mockPlanRepo.findOne.mockResolvedValue(mockNewPlan);

      await expect(service.changeSubscriptionPlan(subscriptionId, changeDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('cancelSubscription', () => {
    it('should cancel subscription immediately', async () => {
      const subscriptionId = 'sub-1';
      const mockSubscription = {
        id: subscriptionId,
        status: SubscriptionStatus.ACTIVE,
        autoRenew: true,
      };

      const cancelledSubscription = {
        ...mockSubscription,
        status: SubscriptionStatus.CANCELLED,
        cancelledAt: new Date(),
        autoRenew: false,
        endDate: new Date(),
      };

      mockSubscriptionRepo.findOne.mockResolvedValue(mockSubscription);
      mockSubscriptionRepo.save.mockResolvedValue(cancelledSubscription);

      const result = await service.cancelSubscription(subscriptionId, 'User requested', true);

      expect(result.status).toBe(SubscriptionStatus.CANCELLED);
      expect(result.autoRenew).toBe(false);
    });

    it('should throw BadRequestException if already cancelled', async () => {
      const subscriptionId = 'sub-1';
      const mockSubscription = {
        id: subscriptionId,
        status: SubscriptionStatus.CANCELLED,
      };

      mockSubscriptionRepo.findOne.mockResolvedValue(mockSubscription);

      await expect(service.cancelSubscription(subscriptionId)).rejects.toThrow(BadRequestException);
    });
  });

  describe('incrementFailedPaymentCount', () => {
    it('should increment failed payment count and mark as past due', async () => {
      const subscriptionId = 'sub-1';
      const mockSubscription = {
        id: subscriptionId,
        consecutiveFailedPayments: 1,
        maxFailedPaymentsBeforeSuspension: 3,
        status: SubscriptionStatus.ACTIVE,
      };

      const updatedSubscription = {
        ...mockSubscription,
        consecutiveFailedPayments: 2,
        status: SubscriptionStatus.PAST_DUE,
      };

      mockSubscriptionRepo.findOne.mockResolvedValue(mockSubscription);
      mockSubscriptionRepo.save.mockResolvedValue(updatedSubscription);

      const result = await service.incrementFailedPaymentCount(subscriptionId);

      expect(result.consecutiveFailedPayments).toBe(2);
      expect(result.status).toBe(SubscriptionStatus.PAST_DUE);
    });

    it('should suspend subscription when threshold is reached', async () => {
      const subscriptionId = 'sub-1';
      const mockSubscription = {
        id: subscriptionId,
        consecutiveFailedPayments: 2,
        maxFailedPaymentsBeforeSuspension: 3,
        status: SubscriptionStatus.ACTIVE,
      };

      const suspendedSubscription = {
        ...mockSubscription,
        consecutiveFailedPayments: 3,
        status: SubscriptionStatus.SUSPENDED,
        metadata: {
          suspensionReason: 'Maximum failed payment threshold exceeded',
          suspendedAt: new Date().toISOString(),
        },
      };

      mockSubscriptionRepo.findOne.mockResolvedValue(mockSubscription);
      mockSubscriptionRepo.save.mockResolvedValue(suspendedSubscription);

      const result = await service.incrementFailedPaymentCount(subscriptionId);

      expect(result.status).toBe(SubscriptionStatus.SUSPENDED);
      expect(result.consecutiveFailedPayments).toBe(3);
    });
  });

  describe('resetFailedPaymentCount', () => {
    it('should reset failed payment count and reactivate subscription', async () => {
      const subscriptionId = 'sub-1';
      const mockSubscription = {
        id: subscriptionId,
        consecutiveFailedPayments: 2,
        status: SubscriptionStatus.PAST_DUE,
      };

      const resetSubscription = {
        ...mockSubscription,
        consecutiveFailedPayments: 0,
        status: SubscriptionStatus.ACTIVE,
      };

      mockSubscriptionRepo.findOne.mockResolvedValue(mockSubscription);
      mockSubscriptionRepo.save.mockResolvedValue(resetSubscription);

      const result = await service.resetFailedPaymentCount(subscriptionId);

      expect(result.consecutiveFailedPayments).toBe(0);
      expect(result.status).toBe(SubscriptionStatus.ACTIVE);
    });
  });
});
