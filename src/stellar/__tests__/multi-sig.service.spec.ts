import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bull';
import { FindOperator } from 'typeorm';
import { MultiSigTransactionService } from '../services/multi-sig-transaction.service';
import { MultiSigTransactionEntity } from '../entities/multi-sig-transaction.entity';
import { StellarPaymentService } from '../services/stellar-payment.service';
import { StellarService, StellarPaymentError } from '../services/stellar.service';
import { MultiSigExecutionProcessor } from '../processors/multi-sig-execution.processor';
import { MultiSigSweepTask } from '../tasks/multi-sig-sweep.task';
import { NotificationsGateway } from '../../notifications/notifications.gateway';
import { NotificationEventType } from '../../notifications/interfaces/notification-event.interface';
import {
  MULTI_SIG_EXECUTE_JOB,
  MULTI_SIG_EXECUTION_QUEUE,
  MultiSigExecutionJobData,
} from '../multi-sig.constants';
import {
  MultiSigTransactionStatus,
  SignatureStatus,
  CreateMultiSigPaymentDto,
} from '../interfaces/multi-sig.interface';

const DESTINATION = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H';
const TX_HASH = 'a'.repeat(64);

const mockConfig = (overrides: { [key: string]: string } = {}) => ({
  get: jest.fn((key: string, defaultVal?: unknown) => overrides[key] ?? defaultVal ?? null),
}) as unknown as ConfigService;

/** Minimal in-memory stand-in for Repository<MultiSigTransactionEntity>. */
function createInMemoryRepo() {
  const store = new Map<string, MultiSigTransactionEntity>();
  let seq = 0;

  const matches = (entity: MultiSigTransactionEntity, where: { [key: string]: unknown } = {}) =>
    Object.entries(where).every(([key, expected]) => {
      const actual = (entity as any)[key];
      if (expected instanceof FindOperator) {
        if (expected.type === 'isNull') return actual === null || actual === undefined;
        if (expected.type === 'lessThan') return actual < expected.value;
        throw new Error(`Unsupported operator ${expected.type}`);
      }
      return actual === expected;
    });

  const repo: any = {
    store,
    create: jest.fn((data: Partial<MultiSigTransactionEntity>) => ({ ...data }) as MultiSigTransactionEntity),
    save: jest.fn(async (entity: MultiSigTransactionEntity) => {
      if (!entity.id) {
        entity.id = `tx-${++seq}`;
        entity.createdAt = new Date();
        entity.executionAttempts = entity.executionAttempts ?? 0;
        entity.stellarTxHash = entity.stellarTxHash ?? null;
      }
      store.set(entity.id, entity);
      return entity;
    }),
    findOne: jest.fn(async ({ where }: any) => [...store.values()].find((e) => matches(e, where)) ?? null),
    find: jest.fn(async ({ where }: any = {}) => [...store.values()].filter((e) => matches(e, where))),
    update: jest.fn(async (criteria: any, partial: Partial<MultiSigTransactionEntity>) => {
      const hits = [...store.values()].filter((e) => matches(e, criteria));
      hits.forEach((e) => Object.assign(e, partial));
      return { affected: hits.length };
    }),
  };
  repo.manager = {
    transaction: jest.fn(async (cb: (manager: any) => Promise<unknown>) =>
      cb({ getRepository: () => repo }),
    ),
  };
  return repo;
}

/** Captures jobs like Bull does, de-duplicating by jobId. */
function createFakeQueue() {
  const jobs: Array<{ name: string; data: MultiSigExecutionJobData; opts?: any; id: string }> = [];
  return {
    jobs,
    add: jest.fn(async (name: string, data: MultiSigExecutionJobData, opts?: { jobId?: string }) => {
      const id = opts?.jobId ?? `job-${jobs.length + 1}`;
      const existing = jobs.find((j) => j.id === id);
      if (existing) return existing;
      const job = { name, data, opts, id };
      jobs.push(job);
      return job;
    }),
  };
}

describe('MultiSigTransactionService', () => {
  let service: MultiSigTransactionService;
  let processor: MultiSigExecutionProcessor;
  let sweepTask: MultiSigSweepTask;
  let repo: ReturnType<typeof createInMemoryRepo>;
  let queue: ReturnType<typeof createFakeQueue>;
  let notifications: { emitNotification: jest.Mock };
  let stellar: { buildPaymentTransaction: jest.Mock; submitSignedTransaction: jest.Mock };

  const createDto: CreateMultiSigPaymentDto = {
    tenantId: 'default',
    destination: DESTINATION,
    amount: '15000',
    asset: 'XLM',
    memo: 'test payment',
  };

  /** Drain the fake queue through the real processor, as a Bull worker would. */
  async function runQueuedJobs() {
    while (queue.jobs.length) {
      const job = queue.jobs.shift();
      expect(job.name).toBe(MULTI_SIG_EXECUTE_JOB);
      await processor.handle({ id: job.id, data: job.data });
    }
  }

  beforeEach(async () => {
    repo = createInMemoryRepo();
    queue = createFakeQueue();
    notifications = { emitNotification: jest.fn() };
    stellar = {
      buildPaymentTransaction: jest.fn().mockResolvedValue({ xdr: 'signed-xdr', hash: TX_HASH }),
      submitSignedTransaction: jest.fn().mockResolvedValue(TX_HASH),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MultiSigTransactionService,
        StellarPaymentService,
        MultiSigExecutionProcessor,
        MultiSigSweepTask,
        {
          provide: ConfigService,
          useValue: mockConfig({
            MULTI_SIG_THRESHOLD_default: '10000',
            MULTI_SIG_QUORUM_default: '2',
            MULTI_SIG_SIGNERS_default: 'signer-1,signer-2,signer-3',
            MULTI_SIG_TTL_MINUTES_default: '60',
            MULTI_SIG_MAX_EXECUTION_ATTEMPTS: '3',
          }),
        },
        { provide: getRepositoryToken(MultiSigTransactionEntity), useValue: repo },
        { provide: getQueueToken(MULTI_SIG_EXECUTION_QUEUE), useValue: queue },
        { provide: StellarService, useValue: stellar },
        { provide: NotificationsGateway, useValue: notifications },
      ],
    }).compile();

    service = module.get(MultiSigTransactionService);
    processor = module.get(MultiSigExecutionProcessor);
    sweepTask = module.get(MultiSigSweepTask);
  });

  describe('createMultiSigPayment', () => {
    it('creates a pending request and notifies every signer', async () => {
      const result = await service.createMultiSigPayment(createDto, 'requester-1');

      expect(result.status).toBe(MultiSigTransactionStatus.PENDING_SIGNATURES);
      expect(result.amount).toBe('15000');
      expect(result.signatures).toHaveLength(3);
      expect(notifications.emitNotification).toHaveBeenCalledTimes(3);
      expect(notifications.emitNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: NotificationEventType.MULTI_SIG_PAYMENT_AWAITING,
          actorId: 'requester-1',
          resourceId: result.id,
          metadata: expect.objectContaining({ targetUserId: 'signer-1', transactionId: result.id }),
        }),
      );
    });

    it('rejects payments below threshold', async () => {
      await expect(
        service.createMultiSigPayment({ ...createDto, amount: '100' }, 'requester-1'),
      ).rejects.toThrow('Amount below threshold');
    });
  });

  describe('approve → enqueue → execute', () => {
    it('enqueues on quorum and the processor submits the payment with a real hash', async () => {
      const { id } = await service.createMultiSigPayment(createDto, 'requester-1');

      const first = await service.approveTransaction(id, { signerId: 'signer-1' });
      expect(first.status).toBe(MultiSigTransactionStatus.PENDING_SIGNATURES);
      expect(queue.add).not.toHaveBeenCalled();

      const second = await service.approveTransaction(id, { signerId: 'signer-2' });
      expect(second.status).toBe(MultiSigTransactionStatus.APPROVED);
      expect(repo.manager.transaction).toHaveBeenCalledTimes(2);
      expect(queue.add).toHaveBeenCalledWith(
        'execute',
        { transactionId: id },
        expect.objectContaining({ jobId: `multi-sig-${id}` }),
      );

      await runQueuedJobs();

      expect(stellar.buildPaymentTransaction).toHaveBeenCalledWith({
        destination: DESTINATION,
        amount: '15000',
        asset: 'XLM',
        memo: 'test payment',
      });
      expect(stellar.submitSignedTransaction).toHaveBeenCalledWith('signed-xdr');

      const stored = repo.store.get(id);
      expect(stored.status).toBe(MultiSigTransactionStatus.EXECUTED);
      expect(stored.stellarTxHash).toBe(TX_HASH);
      expect(stored.xdr).toBe('signed-xdr');

      const status = await service.getTransactionStatus(id);
      expect(status.stellarTxHash).toBe(TX_HASH);
    });

    it('keeps the approval when enqueueing fails, and the sweep enqueues it later', async () => {
      const { id } = await service.createMultiSigPayment(createDto, 'requester-1');
      await service.approveTransaction(id, { signerId: 'signer-1' });

      queue.add.mockRejectedValueOnce(new Error('redis down'));
      const approved = await service.approveTransaction(id, { signerId: 'signer-2' });
      expect(approved.status).toBe(MultiSigTransactionStatus.APPROVED);
      expect(queue.jobs).toHaveLength(0);

      await sweepTask.handleSweep();
      expect(queue.jobs).toEqual([expect.objectContaining({ data: { transactionId: id } })]);

      await runQueuedJobs();
      expect(repo.store.get(id).status).toBe(MultiSigTransactionStatus.EXECUTED);
    });

    it('leaves a retryable failure APPROVED and resubmits the same signed envelope', async () => {
      const { id } = await service.createMultiSigPayment(createDto, 'requester-1');
      await service.approveTransaction(id, { signerId: 'signer-1' });
      await service.approveTransaction(id, { signerId: 'signer-2' });

      stellar.submitSignedTransaction.mockRejectedValueOnce(
        new StellarPaymentError('Payment submission failed (timeout)', true),
      );
      await runQueuedJobs();

      const afterFailure = repo.store.get(id);
      expect(afterFailure.status).toBe(MultiSigTransactionStatus.APPROVED);
      expect(afterFailure.executionAttempts).toBe(1);
      expect(afterFailure.lastError).toContain('timeout');
      expect(afterFailure.xdr).toBe('signed-xdr');

      await expect(service.sweepApprovedTransactions()).resolves.toBe(1);
      await runQueuedJobs();

      // The retry reuses the persisted envelope instead of building a new payment.
      expect(stellar.buildPaymentTransaction).toHaveBeenCalledTimes(1);
      expect(stellar.submitSignedTransaction).toHaveBeenCalledTimes(2);
      expect(repo.store.get(id).status).toBe(MultiSigTransactionStatus.EXECUTED);
      expect(repo.store.get(id).lastError).toBeNull();
    });

    it('marks a terminal failure EXECUTION_FAILED and does not sweep it again', async () => {
      const { id } = await service.createMultiSigPayment(createDto, 'requester-1');
      await service.approveTransaction(id, { signerId: 'signer-1' });
      await service.approveTransaction(id, { signerId: 'signer-2' });

      stellar.submitSignedTransaction.mockRejectedValueOnce(
        new StellarPaymentError('insufficient funds (op_underfunded)', false, 'op_underfunded'),
      );
      await runQueuedJobs();

      expect(repo.store.get(id).status).toBe(MultiSigTransactionStatus.EXECUTION_FAILED);
      await expect(service.sweepApprovedTransactions()).resolves.toBe(0);
    });

    it('gives up after MULTI_SIG_MAX_EXECUTION_ATTEMPTS retryable failures', async () => {
      const { id } = await service.createMultiSigPayment(createDto, 'requester-1');
      await service.approveTransaction(id, { signerId: 'signer-1' });
      await service.approveTransaction(id, { signerId: 'signer-2' });
      stellar.submitSignedTransaction.mockRejectedValue(new StellarPaymentError('horizon 503', true));

      for (let i = 0; i < 3; i++) {
        await service.sweepApprovedTransactions();
        await runQueuedJobs();
      }

      const stored = repo.store.get(id);
      expect(stored.executionAttempts).toBe(3);
      expect(stored.status).toBe(MultiSigTransactionStatus.EXECUTION_FAILED);
    });

    it('does not execute a transaction twice', async () => {
      const { id } = await service.createMultiSigPayment(createDto, 'requester-1');
      await service.approveTransaction(id, { signerId: 'signer-1' });
      await service.approveTransaction(id, { signerId: 'signer-2' });
      await runQueuedJobs();

      await service.executeApprovedTransaction(id);
      await expect(service.sweepApprovedTransactions()).resolves.toBe(0);
      expect(stellar.submitSignedTransaction).toHaveBeenCalledTimes(1);
    });

    it('de-duplicates repeated sweeps while a job is still queued', async () => {
      const { id } = await service.createMultiSigPayment(createDto, 'requester-1');
      await service.approveTransaction(id, { signerId: 'signer-1' });
      await service.approveTransaction(id, { signerId: 'signer-2' });

      await service.sweepApprovedTransactions();
      await service.sweepApprovedTransactions();

      expect(queue.jobs).toHaveLength(1);
    });
  });

  describe('MultiSigExecutionProcessor', () => {
    it('reads the transaction id from job.data', async () => {
      const spy = jest.spyOn(service, 'executeApprovedTransaction').mockResolvedValue(undefined);
      await processor.handle({ id: 'job-1', data: { transactionId: 'tx-42' } });
      expect(spy).toHaveBeenCalledWith('tx-42');
    });

    it('ignores jobs without a transaction id', async () => {
      const spy = jest.spyOn(service, 'executeApprovedTransaction');
      await processor.handle({ id: 'job-1', data: {} as MultiSigExecutionJobData });
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('approval rules', () => {
    let id: string;

    beforeEach(async () => {
      ({ id } = await service.createMultiSigPayment(createDto, 'requester-1'));
    });

    it('rejects and cancels the transaction', async () => {
      const result = await service.rejectTransaction(id, { signerId: 'signer-1', reason: 'Insufficient funds' });
      expect(result.status).toBe(MultiSigTransactionStatus.REJECTED);
    });

    it('rejects duplicate approvals', async () => {
      await service.approveTransaction(id, { signerId: 'signer-1' });
      await expect(service.approveTransaction(id, { signerId: 'signer-1' })).rejects.toThrow('Already approved');
    });

    it('rejects unknown signers', async () => {
      await expect(service.approveTransaction(id, { signerId: 'intruder' })).rejects.toThrow('Not authorised');
    });

    it('rejects approval of an already rejected signature', async () => {
      repo.store.get(id).signatures[0].status = SignatureStatus.REJECTED;
      await expect(service.approveTransaction(id, { signerId: 'signer-1' })).rejects.toThrow('Already rejected');
    });

    it('persists EXPIRED and rejects approval of an expired transaction', async () => {
      repo.store.get(id).expiresAt = new Date(Date.now() - 1000);

      await expect(service.approveTransaction(id, { signerId: 'signer-1' })).rejects.toThrow('expired');
      expect(repo.store.get(id).status).toBe(MultiSigTransactionStatus.EXPIRED);
      expect(queue.add).not.toHaveBeenCalled();
    });

    it('throws NotFound for an unknown transaction', async () => {
      await expect(service.approveTransaction('missing', { signerId: 'signer-1' })).rejects.toThrow('Not found');
    });
  });

  describe('queries', () => {
    it('expires stale pending transactions', async () => {
      const { id } = await service.createMultiSigPayment(createDto, 'requester-1');
      repo.store.get(id).expiresAt = new Date(Date.now() - 1000);

      await expect(service.expireStaleTransactions()).resolves.toBe(1);
      expect(repo.store.get(id).status).toBe(MultiSigTransactionStatus.EXPIRED);
    });

    it('returns transaction status and throws for unknown ids', async () => {
      const { id } = await service.createMultiSigPayment(createDto, 'requester-1');
      await expect(service.getTransactionStatus(id)).resolves.toEqual(expect.objectContaining({ id }));
      await expect(service.getTransactionStatus('nonexistent')).rejects.toThrow('Transaction not found');
    });

    it('lists pending transactions for a tenant', async () => {
      await service.createMultiSigPayment(createDto, 'requester-1');
      await service.createMultiSigPayment({ ...createDto, tenantId: 'other' }, 'requester-1');

      await expect(service.listPendingTransactions('default')).resolves.toHaveLength(1);
    });
  });
});
