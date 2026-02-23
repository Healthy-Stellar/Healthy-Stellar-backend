import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { StellarService } from './stellar.service';

// ── Mock @stellar/stellar-sdk ─────────────────────────────────────────────

const mockSendTransaction = jest.fn();
const mockGetTransaction = jest.fn();
const mockSimulateTransaction = jest.fn();
const mockLoadAccount = jest.fn();

jest.mock('@stellar/stellar-sdk', () => {
  const actual = jest.requireActual('@stellar/stellar-sdk');

  const MockServer = jest.fn().mockImplementation(() => ({
    simulateTransaction: mockSimulateTransaction,
    sendTransaction: mockSendTransaction,
    getTransaction: mockGetTransaction,
  }));

  const MockHorizonServer = jest.fn().mockImplementation(() => ({
    loadAccount: mockLoadAccount,
  }));

  class MockContract {
    call(method: string, ...args: any[]) {
      return { type: 'invokeHostFunction', method, args };
    }
  }

  class MockTransactionBuilder {
    addOperation() {
      return this;
    }
    setTimeout() {
      return this;
    }
    build() {
      return {
        sign: jest.fn(),
        toXDR: jest.fn().mockReturnValue('xdr-string'),
      };
    }
  }

  return {
    ...actual,
    SorobanRpc: {
      Server: MockServer,
      assembleTransaction: jest
        .fn()
        .mockReturnValue({ build: jest.fn().mockReturnValue({ sign: jest.fn() }) }),
      Api: {
        isSimulationError: jest.fn().mockReturnValue(false),
        GetTransactionStatus: {
          SUCCESS: 'SUCCESS',
          FAILED: 'FAILED',
          NOT_FOUND: 'NOT_FOUND',
        },
      },
    },
    Horizon: {
      Server: MockHorizonServer,
    },
    Contract: MockContract,
    TransactionBuilder: MockTransactionBuilder,
    Keypair: {
      fromSecret: jest.fn().mockReturnValue({
        publicKey: jest.fn().mockReturnValue('GABC123'),
        sign: jest.fn(),
      }),
    },
    Networks: actual.Networks,
    nativeToScVal: jest.fn((val) => ({ value: val })),
    scValToNative: jest.fn(() => ({ has_access: true, expires_at: BigInt(9999999999000) })),
  };
});

// ── Helpers ───────────────────────────────────────────────────────────────

const MOCK_ACCOUNT = {
  accountId: () => 'GABC123',
  sequenceNumber: () => '1',
  incrementSequenceNumber: jest.fn(),
};

const MOCK_SIM_SUCCESS = {
  result: {
    retval: { type: 'bool', value: true },
  },
  minResourceFee: '100',
  transactionData: {},
};

const MOCK_TX_HASH = 'deadbeefcafe1234deadbeefcafe1234deadbeefcafe1234deadbeefcafe1234';

const MOCK_CONFIRMED = {
  status: 'SUCCESS',
  ledger: 42,
};

// ── Tests ─────────────────────────────────────────────────────────────────

describe('StellarService', () => {
  let service: StellarService;

  const configValues: Record<string, string> = {
    STELLAR_NETWORK: 'testnet',
    STELLAR_SECRET_KEY: 'SCZANGBA5RLXQ3KKFUP3VSTQBKGVCZXHBP4PMVHKXMBM6BWHPAXD6T3', // random valid testnet key
    STELLAR_CONTRACT_ID: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
    STELLAR_FEE_BUDGET: '10000000',
    STELLAR_MAX_RETRIES: '3',
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    mockLoadAccount.mockResolvedValue(MOCK_ACCOUNT);
    mockSimulateTransaction.mockResolvedValue(MOCK_SIM_SUCCESS);
    mockSendTransaction.mockResolvedValue({ status: 'PENDING', hash: MOCK_TX_HASH });
    mockGetTransaction.mockResolvedValue(MOCK_CONFIRMED);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StellarService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, fallback?: string) => configValues[key] ?? fallback),
          },
        },
      ],
    }).compile();

    service = module.get<StellarService>(StellarService);
  });

  // ── anchorRecord ─────────────────────────────────────────────────────────

  describe('anchorRecord', () => {
    it('should return a tx hash on success', async () => {
      const result = await service.anchorRecord('patient-001', 'QmHash123');

      expect(result).toMatchObject({
        txHash: MOCK_TX_HASH,
        ledger: 42,
      });
      expect(mockSendTransaction).toHaveBeenCalledTimes(1);
    });

    it('should retry on transient Horizon error then succeed', async () => {
      mockSendTransaction
        .mockResolvedValueOnce({ status: 'ERROR', errorResult: { code: 'timeout' } })
        .mockResolvedValueOnce({ status: 'PENDING', hash: MOCK_TX_HASH });

      // First call sends ERROR ➜ retry ➜ second call sends PENDING ➜ confirmed
      const result = await service.anchorRecord('patient-002', 'QmOther');
      expect(result.txHash).toBe(MOCK_TX_HASH);
      expect(mockSendTransaction).toHaveBeenCalledTimes(2);
    });

    it('should throw after max retries are exhausted', async () => {
      mockSendTransaction.mockRejectedValue(new Error('Horizon unreachable'));

      await expect(service.anchorRecord('patient-003', 'QmFail')).rejects.toThrow(
        'Horizon unreachable',
      );
      expect(mockSendTransaction).toHaveBeenCalledTimes(3);
    });
  });

  // ── grantAccess ──────────────────────────────────────────────────────────

  describe('grantAccess', () => {
    it('should return a tx hash on success', async () => {
      const result = await service.grantAccess(
        'patient-001',
        'doctor-007',
        'record-abc',
        new Date(Date.now() + 86_400_000),
      );

      expect(result.txHash).toBe(MOCK_TX_HASH);
      expect(mockSendTransaction).toHaveBeenCalledTimes(1);
    });
  });

  // ── revokeAccess ─────────────────────────────────────────────────────────

  describe('revokeAccess', () => {
    it('should return a tx hash on success', async () => {
      const result = await service.revokeAccess('patient-001', 'doctor-007', 'record-abc');
      expect(result.txHash).toBe(MOCK_TX_HASH);
    });

    it('should retry and eventually fail after max retries', async () => {
      mockSendTransaction.mockRejectedValue(new Error('Network error'));

      await expect(service.revokeAccess('patient-001', 'doctor-007', 'record-abc')).rejects.toThrow(
        'Network error',
      );

      expect(mockSendTransaction).toHaveBeenCalledTimes(3);
    });
  });

  // ── verifyAccess ─────────────────────────────────────────────────────────

  describe('verifyAccess', () => {
    it('should return hasAccess=true when contract simulation says so', async () => {
      const result = await service.verifyAccess('doctor-007', 'record-abc');

      expect(result.hasAccess).toBe(true);
      expect(result.expiresAt).not.toBeNull();
      // No submission should occur for a read-only call
      expect(mockSendTransaction).not.toHaveBeenCalled();
    });

    it('should return hasAccess=false when simulation returns an error', async () => {
      const { SorobanRpc } = jest.requireMock('@stellar/stellar-sdk');
      SorobanRpc.Api.isSimulationError.mockReturnValueOnce(true);
      mockSimulateTransaction.mockResolvedValueOnce({
        error: 'Contract not found',
      });

      const result = await service.verifyAccess('unknown-user', 'record-xyz');
      expect(result.hasAccess).toBe(false);
      expect(result.expiresAt).toBeNull();
    });

    it('should retry on simulation network failure', async () => {
      const { SorobanRpc } = jest.requireMock('@stellar/stellar-sdk');
      SorobanRpc.Api.isSimulationError.mockReturnValue(false);
      mockSimulateTransaction
        .mockRejectedValueOnce(new Error('transient rpc error'))
        .mockResolvedValueOnce(MOCK_SIM_SUCCESS);

      const result = await service.verifyAccess('doctor-007', 'record-abc');
      expect(result.hasAccess).toBe(true);
      expect(mockSimulateTransaction).toHaveBeenCalledTimes(2);
    });
  });

  // ── Retry / backoff ──────────────────────────────────────────────────────

  describe('retry logic', () => {
    it('exponential delay grows correctly (2^0=1, 2^1=2 × BASE_DELAY)', async () => {
      // Spy on sleep via Date.now differences would be flaky; instead just verify
      // that for 3 retries sendTransaction is called exactly 3 times.
      mockSendTransaction.mockRejectedValue(new Error('always fails'));

      const start = Date.now();
      await expect(service.anchorRecord('patient-x', 'QmX')).rejects.toThrow('always fails');
      const elapsed = Date.now() - start;

      // BASE_DELAY is 500 ms; with max 3 retries, min elapsed = 500+1000 = 1500ms
      // We allow some slack for CI
      expect(elapsed).toBeGreaterThanOrEqual(1400);
      expect(mockSendTransaction).toHaveBeenCalledTimes(3);
    }, 15_000); // increase timeout for backoff
  });
});
