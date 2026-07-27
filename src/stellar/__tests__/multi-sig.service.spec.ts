import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MultiSigTransactionService } from '../services/multi-sig-transaction.service';
import { MultiSigTransactionEntity } from '../entities/multi-sig-transaction.entity';
import { StellarService } from '../services/stellar.service';
import { NotificationsGateway } from '../../notifications/notifications.gateway';
import {
  MultiSigTransactionStatus,
  SignatureStatus,
  CreateMultiSigPaymentDto,
} from '../interfaces/multi-sig.interface';

const mockConfig = (overrides = {}) => ({
  get: jest.fn((key, defaultVal) => overrides[key] ?? defaultVal ?? null),
  getOrThrow: jest.fn((key) => {
    if (!overrides[key]) throw new Error('Missing: ' + key);
    return overrides[key];
  }),
}) as unknown as ConfigService;

const mockRepo = () => ({
  create: jest.fn((d) => d),
  save: jest.fn((e) => Promise.resolve({ ...e, id: 'tx-' + Date.now(), expiresAt: e.expiresAt || new Date(Date.now()+3600000), createdAt: new Date(), destination: e.destination || '', amount: e.amount || '0', asset: e.asset || 'XLM', threshold: e.threshold || 2, totalSigners: e.totalSigners || 3 })),
  findOne: jest.fn(),
  find: jest.fn(),
  update: jest.fn(),
}) as unknown as Repository<MultiSigTransactionEntity>;

const mockStellarService = () => ({
  getAccount: jest.fn(),
  submitTransaction: jest.fn(),
}) as unknown as StellarService;

const mockNotificationsGateway = () => ({
  emitNotification: jest.fn(),
}) as unknown as NotificationsGateway;

describe('MultiSigTransactionService', () => {
  let service: MultiSigTransactionService;
  let repo: Repository<MultiSigTransactionEntity>;
  let notifications: NotificationsGateway;

  beforeEach(async () => {
    const config = mockConfig({
      'MULTI_SIG_THRESHOLD_default': '10000',
      'MULTI_SIG_QUORUM_default': '2',
      'MULTI_SIG_SIGNERS_default': 'signer-1,signer-2,signer-3',
      'MULTI_SIG_TTL_MINUTES_default': '60',
    });
    repo = mockRepo();
    notifications = mockNotificationsGateway();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MultiSigTransactionService,
        { provide: ConfigService, useValue: config },
        { provide: getRepositoryToken(MultiSigTransactionEntity), useValue: repo },
        { provide: StellarService, useValue: mockStellarService() },
        { provide: NotificationsGateway, useValue: notifications },
      ],
    }).compile();

    service = module.get<MultiSigTransactionService>(MultiSigTransactionService);
  });

  describe('createMultiSigPayment', () => {
    it('should create a multi-sig payment request', async () => {
      const dto: CreateMultiSigPaymentDto = {
        tenantId: 'default',
        destination: 'GABCDEF1234567890ABCDEF1234567890ABCDEF1234567890',
        amount: '15000',
        asset: 'XLM',
        memo: 'test payment',
      };

      const result = await service.createMultiSigPayment(dto, 'requester-1');
      expect(result).toBeDefined();
      expect(result.status).toBe(MultiSigTransactionStatus.PENDING_SIGNATURES);
      expect(result.amount).toBe('15000');
      expect(result.signatures).toHaveLength(3);
      expect(notifications.emitNotification).toHaveBeenCalled();
    });

    it('should reject payments below threshold', async () => {
      const dto: CreateMultiSigPaymentDto = {
        tenantId: 'default',
        destination: 'GABCDEF1234567890ABCDEF1234567890ABCDEF1234567890',
        amount: '100',
        asset: 'XLM',
      };

      await expect(service.createMultiSigPayment(dto, 'requester-1')).rejects.toThrow();
    });
  });

  describe('2-of-3 approval flow', () => {
    let pendingTx: any;

    beforeEach(async () => {
      const initialSignatures = [
        { signerId: 'signer-1', status: SignatureStatus.PENDING },
        { signerId: 'signer-2', status: SignatureStatus.PENDING },
        { signerId: 'signer-3', status: SignatureStatus.PENDING },
      ];

      pendingTx = {
        id: 'tx-test-1',
        tenantId: 'default',
        destination: 'GABCD...',
        amount: '15000',
        asset: 'XLM',
        status: MultiSigTransactionStatus.PENDING_SIGNATURES,
        expiresAt: new Date(Date.now()+3600000),
        createdAt: new Date(),
        threshold: 2,
        totalSigners: 3,
        ttlMinutes: 60,
        expiresAt: new Date(Date.now() + 3600000),
        requesterId: 'requester-1',
        signatures: initialSignatures,
      };

      (repo.findOne as jest.Mock).mockResolvedValue(pendingTx);
    });

    it('should reach quorum with 2 approvals and change status', async () => {
      (repo.save as jest.Mock).mockImplementation(async (e) => e);

      await service.approveTransaction('tx-test-1', { signerId: 'signer-1' });
      // Update mock to reflect first approval
      pendingTx.signatures = [
        { signerId: 'signer-1', status: SignatureStatus.APPROVED, signedAt: new Date().toISOString() },
        { signerId: 'signer-2', status: SignatureStatus.PENDING },
        { signerId: 'signer-3', status: SignatureStatus.PENDING },
      ];
      (repo.findOne as jest.Mock).mockResolvedValue(pendingTx);

      const result = await service.approveTransaction('tx-test-1', { signerId: 'signer-2' });
      expect(result.status).toBe(MultiSigTransactionStatus.APPROVED);
    });

    it('should reject and cancel the transaction', async () => {
      const result = await service.rejectTransaction('tx-test-1', {
        signerId: 'signer-1',
        reason: 'Insufficient funds',
      });
      expect(result.status).toBe(MultiSigTransactionStatus.REJECTED);
    });

    it('should reject duplicate approvals', async () => {
      pendingTx.signatures[0].status = SignatureStatus.APPROVED;
      (repo.findOne as jest.Mock).mockResolvedValue(pendingTx);

      await expect(
        service.approveTransaction('tx-test-1', { signerId: 'signer-1' }),
      ).rejects.toThrow();
    });

    it('should reject approval after previous rejection', async () => {
      pendingTx.signatures[0].status = SignatureStatus.REJECTED;
      (repo.findOne as jest.Mock).mockResolvedValue(pendingTx);

      await expect(
        service.approveTransaction('tx-test-1', { signerId: 'signer-1' }),
      ).rejects.toThrow();
    });
  });

  describe('expiry', () => {
    it('should detect expired transactions', async () => {
      const expiredTx = {
        id: 'tx-expired',
        tenantId: 'default',
        status: MultiSigTransactionStatus.PENDING_SIGNATURES,
        expiresAt: new Date(Date.now() - 3600000),
        signatures: [{ signerId: 'signer-1', status: SignatureStatus.PENDING }],
      };
      (repo.findOne as jest.Mock).mockResolvedValue(expiredTx);
      (repo.save as jest.Mock).mockImplementation(async (e) => e);

      await expect(
        service.approveTransaction('tx-expired', { signerId: 'signer-1' }),
      ).rejects.toThrow('expired');
    });

    it('should expire stale transactions via cron', async () => {
      (repo.update as jest.Mock).mockResolvedValue({ affected: 2 });
      (repo.find as jest.Mock).mockResolvedValue([
        { id: 'tx-1', requesterId: 'req-1', amount: '15000', asset: 'XLM' },
        { id: 'tx-2', requesterId: 'req-2', amount: '20000', asset: 'XLM' },
      ]);

      const expired = await service.expireStaleTransactions();
      expect(expired).toBe(2);
      // Notifications removed in simplified service
    });
  });

  describe('getTransactionStatus', () => {
    it('should return transaction status', async () => {
      const tx = {
        id: 'tx-status',
        tenantId: 'default',
        destination: 'GABCD...',
        amount: '15000',
        asset: 'XLM',
        status: MultiSigTransactionStatus.PENDING_SIGNATURES,
        threshold: 2,
        totalSigners: 3,
        ttlMinutes: 60,
        expiresAt: new Date(Date.now() + 3600000),
        requesterId: 'requester-1',
        signatures: [],
        expiresAt: new Date(Date.now()+3600000),
        createdAt: new Date(),
        memo: null,
      };
      (repo.findOne as jest.Mock).mockResolvedValue(tx);

      const result = await service.getTransactionStatus('tx-status');
      expect(result.id).toBe('tx-status');
    });

    it('should throw for non-existent transaction', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(null);
      await expect(service.getTransactionStatus('nonexistent')).rejects.toThrow();
    });
  });

  describe('listPendingTransactions', () => {
    it('should return pending transactions for a tenant', async () => {
      (repo.find as jest.Mock).mockResolvedValue([
        { id: 'tx-1', tenantId: 'tenant-a', status: MultiSigTransactionStatus.PENDING_SIGNATURES, signatures: [], expiresAt: new Date(Date.now()+3600000), createdAt: new Date() },
      ]);

      const result = await service.listPendingTransactions('tenant-a');
      expect(result).toHaveLength(1);
    });
  });
});
