import { Test, TestingModule } from '@nestjs/testing';
import { MultiSigController } from './multi-sig.controller';
import { MultiSigTransactionService } from '../services/multi-sig-transaction.service';
import {
  CreateMultiSigPaymentDto,
  MultiSigTransactionResponse,
  MultiSigTransactionStatus,
  SignatureStatus,
} from '../interfaces/multi-sig.interface';
import { UserRole } from '../../auth/entities/user.entity';

describe('MultiSigController', () => {
  let controller: MultiSigController;
  let service: MultiSigTransactionService;

  const mockResponse: MultiSigTransactionResponse = {
    id: 'tx-12345',
    tenantId: 'tenant-test',
    destination: 'GBZXN7PIRZGNMHGA728R374UOGSDKAEEVYNOAO6B4OAXF7YR3K2N45UA',
    amount: '50000',
    asset: 'XLM',
    threshold: 2,
    totalSigners: 3,
    status: MultiSigTransactionStatus.PENDING_SIGNATURES,
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    signatures: [
      { signerId: 'signer-1', status: SignatureStatus.PENDING },
      { signerId: 'signer-2', status: SignatureStatus.PENDING },
      { signerId: 'signer-3', status: SignatureStatus.PENDING },
    ],
    createdAt: new Date().toISOString(),
  };

  const mockMultiSigService = {
    createMultiSigPayment: jest.fn(),
    approveTransaction: jest.fn(),
    rejectTransaction: jest.fn(),
    sweepApprovedTransactions: jest.fn(),
    getTransactionStatus: jest.fn(),
    listPendingTransactions: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MultiSigController],
      providers: [
        {
          provide: MultiSigTransactionService,
          useValue: mockMultiSigService,
        },
      ],
    }).compile();

    controller = module.get<MultiSigController>(MultiSigController);
    service = module.get<MultiSigTransactionService>(MultiSigTransactionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createPayment', () => {
    it('should extract requesterId from req.user.userId and call createMultiSigPayment', async () => {
      const dto: CreateMultiSigPaymentDto = {
        destination: 'GBZXN7PIRZGNMHGA728R374UOGSDKAEEVYNOAO6B4OAXF7YR3K2N45UA',
        amount: '50000',
        asset: 'XLM',
      };
      const req = {
        user: {
          userId: 'user-auth-123',
          organizationId: 'tenant-test',
        },
      };

      mockMultiSigService.createMultiSigPayment.mockResolvedValue(mockResponse);

      const result = await controller.createPayment(dto, req);

      expect(result).toEqual(mockResponse);
      expect(mockMultiSigService.createMultiSigPayment).toHaveBeenCalledWith(
        dto,
        'user-auth-123',
        'tenant-test',
      );
    });

    it('should reject users without an organization', async () => {
      const dto: CreateMultiSigPaymentDto = {
        destination: 'GBZXN7PIRZGNMHGA728R374UOGSDKAEEVYNOAO6B4OAXF7YR3K2N45UA',
        amount: '50000',
        asset: 'XLM',
      };
      await expect(
        controller.createPayment(dto, { user: { userId: 'user-auth-123', organizationId: '' } }),
      ).rejects.toThrow('Authenticated user has no organization');
    });
  });

  describe('approvePayment', () => {
    it('should use the authenticated user as signer', async () => {
      const approvedResponse = {
        ...mockResponse,
        status: MultiSigTransactionStatus.APPROVED,
      };

      mockMultiSigService.approveTransaction.mockResolvedValue(approvedResponse);

      const result = await controller.approvePayment('tx-12345', {
        user: { userId: 'signer-1', organizationId: 'tenant-test' },
      });

      expect(result).toEqual(approvedResponse);
      expect(mockMultiSigService.approveTransaction).toHaveBeenCalledWith(
        'tx-12345',
        'tenant-test',
        'signer-1',
      );
    });
  });

  describe('rejectPayment', () => {
    it('should use the authenticated user as signer and pass the rejection reason', async () => {
      const dto = { reason: 'Unauthorized amount' };
      const rejectedResponse = {
        ...mockResponse,
        status: MultiSigTransactionStatus.REJECTED,
      };

      mockMultiSigService.rejectTransaction.mockResolvedValue(rejectedResponse);

      const result = await controller.rejectPayment('tx-12345', dto, {
        user: { userId: 'signer-2', organizationId: 'tenant-test' },
      });

      expect(result).toEqual(rejectedResponse);
      expect(mockMultiSigService.rejectTransaction).toHaveBeenCalledWith(
        'tx-12345',
        'tenant-test',
        'signer-2',
        'Unauthorized amount',
      );
    });
  });

  describe('sweepApprovedPayments', () => {
    it('should trigger sweep on multiSigService and return processed count', async () => {
      mockMultiSigService.sweepApprovedTransactions.mockResolvedValue(3);

      const result = await controller.sweepApprovedPayments();

      expect(result).toEqual({ processed: 3 });
      expect(mockMultiSigService.sweepApprovedTransactions).toHaveBeenCalled();
    });
  });

  describe('getPaymentStatus', () => {
    it('should return transaction status from multiSigService', async () => {
      mockMultiSigService.getTransactionStatus.mockResolvedValue(mockResponse);

      const result = await controller.getPaymentStatus('tx-12345', {
        user: { userId: 'user-auth-123', organizationId: 'tenant-test' },
      });

      expect(result).toEqual(mockResponse);
      expect(mockMultiSigService.getTransactionStatus).toHaveBeenCalledWith(
        'tx-12345',
        'tenant-test',
      );
    });
  });

  describe('listPending', () => {
    it('should extract tenantId from req.user.organizationId, ignoring req.query spoofing', async () => {
      const req = {
        user: {
          userId: 'user-auth-123',
          organizationId: 'authentic-tenant-id',
        },
        query: {
          tenantId: 'spoofed-tenant-id',
        },
      };

      mockMultiSigService.listPendingTransactions.mockResolvedValue([mockResponse]);

      const result = await controller.listPending(req);

      expect(result).toEqual([mockResponse]);
      expect(mockMultiSigService.listPendingTransactions).toHaveBeenCalledWith(
        'authentic-tenant-id',
      );
    });

    it('should reject users without an organization', async () => {
      await expect(
        controller.listPending({ user: { userId: 'user-auth-123', organizationId: '' } }),
      ).rejects.toThrow('Authenticated user has no organization');
    });
  });

  it('restricts sweep to admins', () => {
    const roles = Reflect.getMetadata('roles', MultiSigController.prototype.sweepApprovedPayments);
    expect(roles).toEqual([UserRole.ADMIN]);
  });
});
