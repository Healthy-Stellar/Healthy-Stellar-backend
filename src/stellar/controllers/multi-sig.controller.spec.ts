import { Test, TestingModule } from '@nestjs/testing';
import { MultiSigController } from './multi-sig.controller';
import { MultiSigTransactionService } from '../services/multi-sig-transaction.service';
import {
  CreateMultiSigPaymentDto,
  ApproveRejectDto,
  MultiSigTransactionResponse,
  MultiSigTransactionStatus,
  SignatureStatus,
} from '../interfaces/multi-sig.interface';

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
        tenantId: 'tenant-test',
        destination: 'GBZXN7PIRZGNMHGA728R374UOGSDKAEEVYNOAO6B4OAXF7YR3K2N45UA',
        amount: '50000',
        asset: 'XLM',
      };
      const req = {
        user: {
          userId: 'user-auth-123',
          tenantId: 'tenant-test',
        },
      };

      mockMultiSigService.createMultiSigPayment.mockResolvedValue(mockResponse);

      const result = await controller.createPayment(dto, req);

      expect(result).toEqual(mockResponse);
      expect(mockMultiSigService.createMultiSigPayment).toHaveBeenCalledWith(
        dto,
        'user-auth-123',
      );
    });

    it('should pass undefined as requesterId if req.user is absent, with no system fallback', async () => {
      const dto: CreateMultiSigPaymentDto = {
        tenantId: 'tenant-test',
        destination: 'GBZXN7PIRZGNMHGA728R374UOGSDKAEEVYNOAO6B4OAXF7YR3K2N45UA',
        amount: '50000',
        asset: 'XLM',
      };
      const req = {};

      mockMultiSigService.createMultiSigPayment.mockResolvedValue(mockResponse);

      const result = await controller.createPayment(dto, req);

      expect(result).toEqual(mockResponse);
      expect(mockMultiSigService.createMultiSigPayment).toHaveBeenCalledWith(
        dto,
        undefined,
      );
    });
  });

  describe('approvePayment', () => {
    it('should delegate to multiSigService.approveTransaction with transaction id and dto', async () => {
      const dto: ApproveRejectDto = {
        signerId: 'signer-1',
      };
      const approvedResponse = {
        ...mockResponse,
        status: MultiSigTransactionStatus.APPROVED,
      };

      mockMultiSigService.approveTransaction.mockResolvedValue(approvedResponse);

      const result = await controller.approvePayment('tx-12345', dto);

      expect(result).toEqual(approvedResponse);
      expect(mockMultiSigService.approveTransaction).toHaveBeenCalledWith('tx-12345', dto);
    });
  });

  describe('rejectPayment', () => {
    it('should delegate to multiSigService.rejectTransaction with transaction id and reason', async () => {
      const dto: ApproveRejectDto = {
        signerId: 'signer-2',
        reason: 'Unauthorized amount',
      };
      const rejectedResponse = {
        ...mockResponse,
        status: MultiSigTransactionStatus.REJECTED,
      };

      mockMultiSigService.rejectTransaction.mockResolvedValue(rejectedResponse);

      const result = await controller.rejectPayment('tx-12345', dto);

      expect(result).toEqual(rejectedResponse);
      expect(mockMultiSigService.rejectTransaction).toHaveBeenCalledWith('tx-12345', dto);
    });
  });

  describe('sweepApprovedPayments', () => {
    it('should trigger sweep on multiSigService and return processed count', async () => {
      mockMultiSigService.sweepApprovedTransactions.mockResolvedValue(3);

      const result = await controller.sweepApprovedPayments();

      expect(result).toEqual(3);
      expect(mockMultiSigService.sweepApprovedTransactions).toHaveBeenCalled();
    });
  });

  describe('getPaymentStatus', () => {
    it('should return transaction status from multiSigService', async () => {
      mockMultiSigService.getTransactionStatus.mockResolvedValue(mockResponse);

      const result = await controller.getPaymentStatus('tx-12345');

      expect(result).toEqual(mockResponse);
      expect(mockMultiSigService.getTransactionStatus).toHaveBeenCalledWith('tx-12345');
    });
  });

  describe('listPending', () => {
    it('should extract tenantId from req.user.tenantId, ignoring req.query spoofing', async () => {
      const req = {
        user: {
          userId: 'user-auth-123',
          tenantId: 'authentic-tenant-id',
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

    it('should pass undefined tenantId when user is absent', async () => {
      const req = {
        query: {
          tenantId: 'spoofed-tenant-id',
        },
      };

      mockMultiSigService.listPendingTransactions.mockResolvedValue([]);

      const result = await controller.listPending(req);

      expect(result).toEqual([]);
      expect(mockMultiSigService.listPendingTransactions).toHaveBeenCalledWith(undefined);
    });
  });
});
