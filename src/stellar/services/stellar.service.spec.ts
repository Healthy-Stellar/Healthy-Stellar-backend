import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { StellarService } from './stellar.service';
import { CircuitBreakerService } from '../../common/circuit-breaker/circuit-breaker.service';

// ── Mock @stellar/stellar-sdk ─────────────────────────────────────────────

const mockSendTransaction = jest.fn();
const mockGetTransaction = jest.fn();
const mockSimulateTransaction = jest.fn();
const mockLoadAccount = jest.fn();
const mockGetEvents = jest.fn();
// mockFromXDR is defined after hoisting; access via module-level var set in beforeEach
let mockFromXDR: jest.Mock;

jest.mock('@stellar/stellar-sdk', () => {
  const actual = jest.requireActual('@stellar/stellar-sdk');

  const MockSorobanServer = jest.fn().mockImplementation(() => ({
    simulateTransaction: mockSimulateTransaction,
    sendTransaction: mockSendTransaction,
    getTransaction: mockGetTransaction,
    getEvents: mockGetEvents,
  }));

  const MockHorizonServer = jest.fn().mockImplementation(() => ({
    loadAccount: mockLoadAccount,
  }));

  class MockContract {
    call(method: string, ...args: any[]) {
      return { type: 'invokeHostFunction', method, args };
    }
  }

  // fromXDR is accessed lazily so hoisting does not cause TDZ errors
  const fromXDRProxy = (...args: any[]) => (mockFromXDR ? mockFromXDR(...args) : { sign: jest.fn() });

  class MockTransactionBuilder {
    static fromXDR = fromXDRProxy;
    addOperation() { return this; }
    setTimeout() { return this; }
    build() {
      return { sign: jest.fn(), toXDR: jest.fn().mockReturnValue('xdr-string') };
    }
  }

  return {
    ...actual,
    SorobanRpc: {
      Server: MockSorobanServer,
      assembleTransaction: jest
        .fn()
        .mockReturnValue({ build: jest.fn().mockReturnValue({ sign: jest.fn() }) }),
      Api: {
        isSimulationError: jest.fn().mockReturnValue(false),
        GetTransactionStatus: { SUCCESS: 'SUCCESS', FAILED: 'FAILED', NOT_FOUND: 'NOT_FOUND' },
      },
    },
    Horizon: { Server: MockHorizonServer },
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
    scValToNative: jest.fn((val) => val?._native ?? val),
  };
});

// ── Shared fixtures ───────────────────────────────────────────────────────

const MOCK_ACCOUNT = {
  accountId: () => 'GABC123',
  sequenceNumber: () => '100',
  incrementSequenceNumber: jest.fn(),
  balances: [
    { asset_type: 'native', balance: '100.0000000' },
    { asset_type: 'credit_alphanum4', asset_code: 'USDC', asset_issuer: 'GISSUER', balance: '50.0' },
  ],
};

const MOCK_SIM_SUCCESS = {
  result: { retval: { _native: 'decoded-return-value' } },
  minResourceFee: '100',
  transactionData: {},
};

const MOCK_TX_HASH = 'deadbeefcafe1234deadbeefcafe1234deadbeefcafe1234deadbeefcafe1234';

const MOCK_CONFIRMED = { status: 'SUCCESS', ledger: 42 };

const BASE_CONFIG: Record<string, string> = {
  STELLAR_NETWORK: 'testnet',
  STELLAR_SECRET_KEY: 'SCZANGBA5RLXQ3KKFUP3VSTQBKGVCZXHBP4PMVHKXMBM6BWHPAXD6T3',
  STELLAR_CONTRACT_ID: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
  STELLAR_FEE_BUDGET: '10000000',
  STELLAR_MAX_RETRIES: '3',
};

async function buildModule(overrides: Record<string, string> = {}): Promise<StellarService> {
  const config = { ...BASE_CONFIG, ...overrides };
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      StellarService,
      {
        provide: ConfigService,
        useValue: {
          get: jest.fn((key: string, fallback?: string) => config[key] ?? fallback),
        },
      },
      {
        provide: CircuitBreakerService,
        useValue: { execute: jest.fn().mockImplementation((_svc: string, fn: () => any) => fn()) },
      },
    ],
  }).compile();
  return module.get<StellarService>(StellarService);
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('StellarService', () => {
  let service: StellarService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockFromXDR = jest.fn().mockReturnValue({ sign: jest.fn() });
    mockLoadAccount.mockResolvedValue(MOCK_ACCOUNT);
    mockSimulateTransaction.mockResolvedValue(MOCK_SIM_SUCCESS);
    mockSendTransaction.mockResolvedValue({ status: 'PENDING', hash: MOCK_TX_HASH });
    mockGetTransaction.mockResolvedValue(MOCK_CONFIRMED);
    service = await buildModule();
  });

  // ── Network switching ─────────────────────────────────────────────────

  describe('network switching', () => {
    it('defaults to testnet when STELLAR_NETWORK is not set', () => {
      expect(service.getNetwork()).toBe('testnet');
    });

    it('uses mainnet when STELLAR_NETWORK=mainnet', async () => {
      const mainnetService = await buildModule({ STELLAR_NETWORK: 'mainnet' });
      expect(mainnetService.getNetwork()).toBe('mainnet');
    });

    it('falls back to testnet for unknown network values', async () => {
      const s = await buildModule({ STELLAR_NETWORK: 'devnet' });
      expect(s.getNetwork()).toBe('testnet');
    });

    it('throws when STELLAR_SECRET_KEY is missing', async () => {
      await expect(buildModule({ STELLAR_SECRET_KEY: '' })).rejects.toThrow(
        'STELLAR_SECRET_KEY environment variable is required',
      );
    });
  });

  // ── submitTransaction ─────────────────────────────────────────────────

  describe('submitTransaction', () => {
    it('returns typed SubmitTransactionResult on success', async () => {
      const result = await service.submitTransaction('base64-xdr-here');

      expect(result).toMatchObject({
        txHash: MOCK_TX_HASH,
        ledger: 42,
        status: 'SUCCESS',
      });
      expect(typeof result.confirmedAt).toBe('number');
      expect(mockSendTransaction).toHaveBeenCalledTimes(1);
    });

    it('throws when sendTransaction returns ERROR status', async () => {
      mockSendTransaction.mockResolvedValue({
        status: 'ERROR',
        errorResult: { code: 'tx_bad_seq' },
      });

      await expect(service.submitTransaction('bad-xdr')).rejects.toThrow('submitTransaction error');
    });

    it('retries on transient failure then succeeds', async () => {
      mockSendTransaction
        .mockRejectedValueOnce(new Error('network timeout'))
        .mockResolvedValueOnce({ status: 'PENDING', hash: MOCK_TX_HASH });

      const result = await service.submitTransaction('xdr');
      expect(result.txHash).toBe(MOCK_TX_HASH);
      expect(mockSendTransaction).toHaveBeenCalledTimes(2);
    });

    it('throws after all retries are exhausted', async () => {
      mockSendTransaction.mockRejectedValue(new Error('persistent failure'));

      await expect(service.submitTransaction('xdr')).rejects.toThrow('persistent failure');
      expect(mockSendTransaction).toHaveBeenCalledTimes(3);
    });

    it('does not leak raw SDK objects in the response', async () => {
      const result = await service.submitTransaction('xdr');
      // Only plain typed fields should be present
      expect(Object.keys(result).sort()).toEqual(
        ['confirmedAt', 'ledger', 'status', 'txHash'].sort(),
      );
    });
  });

  // ── getAccount ────────────────────────────────────────────────────────

  describe('getAccount', () => {
    it('returns typed StellarAccountInfo', async () => {
      const result = await service.getAccount('GABC123');

      expect(result).toMatchObject({
        accountId: 'GABC123',
        sequence: '100',
      });
      expect(Array.isArray(result.balances)).toBe(true);
      expect(result.balances[0]).toMatchObject({ asset: 'XLM', balance: '100.0000000' });
      expect(result.balances[1]).toMatchObject({ asset: 'USDC:GISSUER', balance: '50.0' });
    });

    it('maps native asset to "XLM"', async () => {
      const result = await service.getAccount('GABC123');
      const xlm = result.balances.find((b) => b.asset === 'XLM');
      expect(xlm).toBeDefined();
    });

    it('maps non-native assets as "CODE:ISSUER"', async () => {
      const result = await service.getAccount('GABC123');
      const usdc = result.balances.find((b) => b.asset.startsWith('USDC'));
      expect(usdc?.asset).toBe('USDC:GISSUER');
    });

    it('does not leak raw AccountResponse object', async () => {
      const result = await service.getAccount('GABC123');
      expect(typeof result.accountId).toBe('string');
      expect(typeof result.sequence).toBe('string');
      expect(Array.isArray(result.balances)).toBe(true);
      // No SDK methods on the result
      expect((result as any).loadAccount).toBeUndefined();
    });

    it('retries on Horizon error', async () => {
      mockLoadAccount
        .mockRejectedValueOnce(new Error('horizon 503'))
        .mockResolvedValueOnce(MOCK_ACCOUNT);

      const result = await service.getAccount('GABC123');
      expect(result.accountId).toBe('GABC123');
      expect(mockLoadAccount).toHaveBeenCalledTimes(2);
    });
  });

  // ── invokeContract ────────────────────────────────────────────────────

  describe('invokeContract', () => {
    const CONTRACT_ID = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';

    it('returns typed InvokeContractResult with decoded returnValue', async () => {
      const result = await service.invokeContract(CONTRACT_ID, 'get_record', []);

      expect(result).toMatchObject({
        txHash: MOCK_TX_HASH,
        ledger: 42,
        returnValue: 'decoded-return-value',
      });
      expect(typeof result.confirmedAt).toBe('number');
    });

    it('returnValue is null when simulation has no retval', async () => {
      mockSimulateTransaction.mockResolvedValueOnce({ result: null, minResourceFee: '100' });

      const result = await service.invokeContract(CONTRACT_ID, 'void_method', []);
      expect(result.returnValue).toBeNull();
    });

    it('throws when simulation returns an error', async () => {
      const { SorobanRpc } = jest.requireMock('@stellar/stellar-sdk');
      SorobanRpc.Api.isSimulationError.mockReturnValue(true);
      mockSimulateTransaction.mockResolvedValue({ error: 'contract not found' });

      await expect(service.invokeContract(CONTRACT_ID, 'bad_method', [])).rejects.toThrow(
        'Soroban simulation failed',
      );

      // restore default for subsequent tests
      SorobanRpc.Api.isSimulationError.mockReturnValue(false);
    });

    it('throws when sendTransaction returns ERROR', async () => {
      mockSendTransaction.mockResolvedValue({
        status: 'ERROR',
        errorResult: { code: 'tx_failed' },
      });

      await expect(service.invokeContract(CONTRACT_ID, 'some_method', [])).rejects.toThrow(
        'invokeContract submission error',
      );

      // restore default for subsequent tests
      mockSendTransaction.mockResolvedValue({ status: 'PENDING', hash: MOCK_TX_HASH });
    });

    it('does not leak raw ScVal in the response', async () => {
      const result = await service.invokeContract(CONTRACT_ID, 'get_record', []);
      // returnValue must be a decoded native type, not an ScVal object with xdr methods
      expect((result.returnValue as any)?.toXDR).toBeUndefined();
    });

    it('retries on transient RPC failure', async () => {
      mockSendTransaction
        .mockRejectedValueOnce(new Error('rpc timeout'))
        .mockResolvedValueOnce({ status: 'PENDING', hash: MOCK_TX_HASH });

      const result = await service.invokeContract(CONTRACT_ID, 'method', []);
      expect(result.txHash).toBe(MOCK_TX_HASH);
      expect(mockSendTransaction).toHaveBeenCalledTimes(2);
    });
  });

  // ── getContractEvents ─────────────────────────────────────────────────

  describe('getContractEvents', () => {
    const MOCK_EVENTS = {
      events: [
        {
          id: 'event-1',
          ledger: 100,
          contractId: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
          topic: [{ _native: 'record_anchored' }, { _native: 'patient-001' }],
          value: { _native: { cid: 'QmHash' } },
        },
        {
          id: 'event-2',
          ledger: 101,
          contractId: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
          topic: [],
          value: null,
        },
      ],
    };

    beforeEach(() => {
      mockGetEvents.mockResolvedValue(MOCK_EVENTS);
    });

    it('returns an array of typed ContractEvent', async () => {
      const results = await service.getContractEvents(100);

      expect(Array.isArray(results)).toBe(true);
      expect(results).toHaveLength(2);
      expect(results[0]).toMatchObject({
        id: 'event-1',
        ledger: 100,
        contractId: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
      });
    });

    it('decodes topics to native values', async () => {
      const results = await service.getContractEvents(100);
      expect(results[0].topics).toEqual(['record_anchored', 'patient-001']);
    });

    it('decodes value to native type', async () => {
      const results = await service.getContractEvents(100);
      expect(results[0].value).toEqual({ cid: 'QmHash' });
    });

    it('sets value to null when event has no value', async () => {
      const results = await service.getContractEvents(100);
      expect(results[1].value).toBeNull();
    });

    it('uses provided contractId filter over default', async () => {
      const customId = 'CCUSTOM123';
      await service.getContractEvents(50, customId);

      expect(mockGetEvents).toHaveBeenCalledWith(
        expect.objectContaining({
          startLedger: 50,
          filters: [expect.objectContaining({ contractIds: [customId] })],
        }),
      );
    });

    it('falls back to configured contractId when none provided', async () => {
      await service.getContractEvents(50);

      expect(mockGetEvents).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: [
            expect.objectContaining({
              contractIds: [BASE_CONFIG.STELLAR_CONTRACT_ID],
            }),
          ],
        }),
      );
    });

    it('returns empty array when no events found', async () => {
      mockGetEvents.mockResolvedValueOnce({ events: [] });
      const results = await service.getContractEvents(200);
      expect(results).toEqual([]);
    });

    it('retries on RPC failure', async () => {
      mockGetEvents
        .mockRejectedValueOnce(new Error('rpc unavailable'))
        .mockResolvedValueOnce(MOCK_EVENTS);

      const results = await service.getContractEvents(100);
      expect(results).toHaveLength(2);
      expect(mockGetEvents).toHaveBeenCalledTimes(2);
    });

    it('throws after all retries exhausted', async () => {
      mockGetEvents.mockRejectedValue(new Error('persistent rpc error'));

      await expect(service.getContractEvents(100)).rejects.toThrow('persistent rpc error');
      expect(mockGetEvents).toHaveBeenCalledTimes(3);
    });
  });

  // ── Existing domain methods (regression) ─────────────────────────────

  describe('anchorRecord', () => {
    it('returns a tx hash on success', async () => {
      const result = await service.anchorRecord('patient-001', 'QmHash123');
      expect(result).toMatchObject({ txHash: MOCK_TX_HASH, ledger: 42 });
      expect(mockSendTransaction).toHaveBeenCalledTimes(1);
    });

    it('retries on transient error then succeeds', async () => {
      mockSendTransaction
        .mockResolvedValueOnce({ status: 'ERROR', errorResult: { code: 'timeout' } })
        .mockResolvedValueOnce({ status: 'PENDING', hash: MOCK_TX_HASH });

      const result = await service.anchorRecord('patient-002', 'QmOther');
      expect(result.txHash).toBe(MOCK_TX_HASH);
      expect(mockSendTransaction).toHaveBeenCalledTimes(2);
    });

    it('throws after max retries exhausted', async () => {
      mockSendTransaction.mockRejectedValue(new Error('Horizon unreachable'));
      await expect(service.anchorRecord('patient-003', 'QmFail')).rejects.toThrow(
        'Horizon unreachable',
      );
      expect(mockSendTransaction).toHaveBeenCalledTimes(3);
    });
  });

  describe('grantAccess', () => {
    it('returns a tx hash on success', async () => {
      const result = await service.grantAccess(
        'patient-001',
        'doctor-007',
        'record-abc',
        new Date(Date.now() + 86_400_000),
      );
      expect(result.txHash).toBe(MOCK_TX_HASH);
    });
  });

  describe('revokeAccess', () => {
    it('returns a tx hash on success', async () => {
      const result = await service.revokeAccess('patient-001', 'doctor-007', 'record-abc');
      expect(result.txHash).toBe(MOCK_TX_HASH);
    });

    it('retries and eventually fails after max retries', async () => {
      mockSendTransaction.mockRejectedValue(new Error('Network error'));
      await expect(
        service.revokeAccess('patient-001', 'doctor-007', 'record-abc'),
      ).rejects.toThrow('Network error');
      expect(mockSendTransaction).toHaveBeenCalledTimes(3);
    });
  });

  describe('verifyAccess', () => {
    it('returns hasAccess=true when simulation succeeds', async () => {
      const { scValToNative } = jest.requireMock('@stellar/stellar-sdk');
      scValToNative.mockReturnValueOnce({ has_access: true, expires_at: BigInt(9999999999000) });

      const result = await service.verifyAccess('doctor-007', 'record-abc');
      expect(result.hasAccess).toBe(true);
      expect(result.expiresAt).not.toBeNull();
      expect(mockSendTransaction).not.toHaveBeenCalled();
    });

    it('returns hasAccess=false when simulation returns an error', async () => {
      const { SorobanRpc } = jest.requireMock('@stellar/stellar-sdk');
      SorobanRpc.Api.isSimulationError.mockReturnValueOnce(true);
      mockSimulateTransaction.mockResolvedValueOnce({ error: 'Contract not found' });

      const result = await service.verifyAccess('unknown-user', 'record-xyz');
      expect(result.hasAccess).toBe(false);
      expect(result.expiresAt).toBeNull();
    });
  });
});
