import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { LedgerReconciliationService } from './ledger-reconciliation.service';
import { ReconciliationRun, ReconciliationRunStatus } from './reconciliation-run.entity';
import { Record } from '../records/entities/record.entity';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const OLD_DATE = new Date(Date.now() - 20 * 60_000); // 20 min ago — past threshold

function makeRecord(overrides: Partial<Record> = {}): Record {
  return Object.assign(new Record(), {
    id: 'rec-1',
    patientId: 'p1',
    cid: 'Qm1',
    stellarTxHash: 'abc123',
    isDeleted: false,
    createdAt: OLD_DATE,
    ...overrides,
  });
}

function makeRun(overrides: Partial<ReconciliationRun> = {}): ReconciliationRun {
  return Object.assign(new ReconciliationRun(), {
    id: 'run-1',
    status: ReconciliationRunStatus.RUNNING,
    startedAt: new Date(),
    completedAt: null,
    recordsChecked: 0,
    confirmed: 0,
    failed: 0,
    missing: 0,
    errors: 0,
    ...overrides,
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildModule(
  records: Record[],
  horizonResult: 'success' | 'failed' | 'not_found' | Error,
) {
  const savedRuns: ReconciliationRun[] = [];

  const recordRepo = {
    find: jest.fn().mockResolvedValue(records),
  };

  const runRepo = {
    create: jest.fn().mockImplementation((data) => makeRun(data)),
    save: jest.fn().mockImplementation((run) => {
      savedRuns.push({ ...run });
      return Promise.resolve({ ...run });
    }),
    findOne: jest.fn().mockResolvedValue(makeRun({ status: ReconciliationRunStatus.COMPLETED })),
  };

  const discrepanciesCounter = { inc: jest.fn() };

  return {
    savedRuns,
    discrepanciesCounter,
    moduleFactory: () =>
      Test.createTestingModule({
        providers: [
          LedgerReconciliationService,
          { provide: getRepositoryToken(Record), useValue: recordRepo },
          { provide: getRepositoryToken(ReconciliationRun), useValue: runRepo },
          {
            provide: ConfigService,
            useValue: { get: jest.fn().mockReturnValue('testnet') },
          },
          {
            provide: 'PROM_METRIC_MEDCHAIN_RECONCILIATION_DISCREPANCIES_TOTAL',
            useValue: discrepanciesCounter,
          },
        ],
      }).compile(),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('LedgerReconciliationService', () => {
  let service: LedgerReconciliationService;

  describe('confirmed scenario', () => {
    beforeEach(async () => {
      const { moduleFactory } = buildModule([makeRecord()], 'success');
      const module: TestingModule = await moduleFactory();
      service = module.get(LedgerReconciliationService);
      jest.spyOn(service, '_queryHorizon').mockResolvedValue('success');
    });

    it('increments confirmed count when tx is successful on-chain', async () => {
      const summary = await service.run();
      expect(summary.confirmed).toBe(1);
      expect(summary.failed).toBe(0);
      expect(summary.missing).toBe(0);
      expect(summary.recordsChecked).toBe(1);
    });

    it('does not increment discrepancies counter for confirmed tx', async () => {
      const { discrepanciesCounter, moduleFactory } = buildModule([makeRecord()], 'success');
      const module: TestingModule = await moduleFactory();
      service = module.get(LedgerReconciliationService);
      jest.spyOn(service, '_queryHorizon').mockResolvedValue('success');

      await service.run();
      expect(discrepanciesCounter.inc).not.toHaveBeenCalled();
    });
  });

  describe('failed scenario', () => {
    beforeEach(async () => {
      const { moduleFactory } = buildModule([makeRecord()], 'failed');
      const module: TestingModule = await moduleFactory();
      service = module.get(LedgerReconciliationService);
      jest.spyOn(service, '_queryHorizon').mockResolvedValue('failed');
    });

    it('increments failed count when tx is on-chain but unsuccessful', async () => {
      const summary = await service.run();
      expect(summary.failed).toBe(1);
      expect(summary.confirmed).toBe(0);
    });

    it('increments discrepancies counter with type=failed', async () => {
      const { discrepanciesCounter, moduleFactory } = buildModule([makeRecord()], 'failed');
      const module: TestingModule = await moduleFactory();
      service = module.get(LedgerReconciliationService);
      jest.spyOn(service, '_queryHorizon').mockResolvedValue('failed');

      await service.run();
      expect(discrepanciesCounter.inc).toHaveBeenCalledWith({ type: 'failed' });
    });
  });

  describe('missing scenario', () => {
    beforeEach(async () => {
      const { moduleFactory } = buildModule([makeRecord()], 'not_found');
      const module: TestingModule = await moduleFactory();
      service = module.get(LedgerReconciliationService);
      jest.spyOn(service, '_queryHorizon').mockResolvedValue('not_found');
    });

    it('increments missing count when tx is not found on Horizon', async () => {
      const summary = await service.run();
      expect(summary.missing).toBe(1);
      expect(summary.confirmed).toBe(0);
      expect(summary.failed).toBe(0);
    });

    it('increments discrepancies counter with type=missing', async () => {
      const { discrepanciesCounter, moduleFactory } = buildModule([makeRecord()], 'not_found');
      const module: TestingModule = await moduleFactory();
      service = module.get(LedgerReconciliationService);
      jest.spyOn(service, '_queryHorizon').mockResolvedValue('not_found');

      await service.run();
      expect(discrepanciesCounter.inc).toHaveBeenCalledWith({ type: 'missing' });
    });
  });

  describe('records without stellarTxHash', () => {
    it('skips records that have no stellarTxHash', async () => {
      const { moduleFactory } = buildModule([makeRecord({ stellarTxHash: null as any })], 'success');
      const module: TestingModule = await moduleFactory();
      service = module.get(LedgerReconciliationService);
      jest.spyOn(service, '_queryHorizon');

      const summary = await service.run();
      expect(summary.recordsChecked).toBe(0);
      expect(service._queryHorizon).not.toHaveBeenCalled();
    });
  });

  describe('Horizon error handling', () => {
    it('increments errors count when Horizon throws an unexpected error', async () => {
      const { moduleFactory } = buildModule([makeRecord()], new Error('network timeout'));
      const module: TestingModule = await moduleFactory();
      service = module.get(LedgerReconciliationService);
      jest.spyOn(service, '_queryHorizon').mockRejectedValue(new Error('network timeout'));

      const summary = await service.run();
      expect(summary.errors).toBe(1);
      expect(summary.confirmed).toBe(0);
    });
  });

  describe('ops alert threshold', () => {
    it('fires an alert when missing count exceeds 5', async () => {
      const records = Array.from({ length: 6 }, (_, i) =>
        makeRecord({ id: `rec-${i}`, stellarTxHash: `hash-${i}` }),
      );
      const { moduleFactory } = buildModule(records, 'not_found');
      const module: TestingModule = await moduleFactory();
      service = module.get(LedgerReconciliationService);
      jest.spyOn(service, '_queryHorizon').mockResolvedValue('not_found');
      const alertSpy = jest.spyOn(service as any, '_alertOps').mockResolvedValue(undefined);

      await service.run();
      expect(alertSpy).toHaveBeenCalledWith(6, expect.any(String));
    });

    it('does not fire an alert when missing count is 5 or below', async () => {
      const records = Array.from({ length: 5 }, (_, i) =>
        makeRecord({ id: `rec-${i}`, stellarTxHash: `hash-${i}` }),
      );
      const { moduleFactory } = buildModule(records, 'not_found');
      const module: TestingModule = await moduleFactory();
      service = module.get(LedgerReconciliationService);
      jest.spyOn(service, '_queryHorizon').mockResolvedValue('not_found');
      const alertSpy = jest.spyOn(service as any, '_alertOps').mockResolvedValue(undefined);

      await service.run();
      expect(alertSpy).not.toHaveBeenCalled();
    });
  });

  describe('getLatestRun', () => {
    it('returns null when no runs exist', async () => {
      const { moduleFactory } = buildModule([], 'success');
      const module: TestingModule = await moduleFactory();
      service = module.get(LedgerReconciliationService);
      // Override findOne to return null
      const runRepo = module.get(getRepositoryToken(ReconciliationRun));
      runRepo.findOne = jest.fn().mockResolvedValue(null);

      expect(await service.getLatestRun()).toBeNull();
    });

    it('returns a summary of the most recent run', async () => {
      const { moduleFactory } = buildModule([], 'success');
      const module: TestingModule = await moduleFactory();
      service = module.get(LedgerReconciliationService);

      const result = await service.getLatestRun();
      expect(result).not.toBeNull();
      expect(result!.status).toBe(ReconciliationRunStatus.COMPLETED);
    });
  });
});
