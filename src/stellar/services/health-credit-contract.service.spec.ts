import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  HealthCreditContractService,
  HealthCreditEventType,
} from './health-credit-contract.service';

/** Minimal stub for the Soroban RPC server responses. */
const buildSorobanStubs = () => {
  const mockSimulateSuccess = {
    result: {
      retval: { switch: () => ({ name: 'scvI128' }), i128: () => ({ lo: () => BigInt(100), hi: () => BigInt(0) } as any) },
    },
    cost: { cpuInsns: '100', memBytes: '100' },
    minResourceFee: '1000',
    stateChanges: [],
  };

  const mockTxStatus = {
    status: 'SUCCESS',
    ledger: 12345,
    txHash: 'mock-tx-hash-abc123',
    createdAt: Math.floor(Date.now() / 1000),
    applicationOrder: 1,
    feeBump: false,
    envelopeXdr: '',
    resultXdr: '',
    resultMetaXdr: '',
  };

  return { mockSimulateSuccess, mockTxStatus };
};

jest.mock('@stellar/stellar-sdk', () => {
  const actual = jest.requireActual('@stellar/stellar-sdk');

  class MockServer {
    simulateTransaction = jest.fn();
    sendTransaction = jest.fn();
    getTransaction = jest.fn();
    loadAccount = jest.fn();
  }

  class MockHorizonServer {
    loadAccount = jest.fn().mockResolvedValue({
      accountId: () => 'GTEST',
      sequenceNumber: () => '100',
      incrementSequenceNumber: jest.fn(),
      sequence: '100',
      balances: [],
    });
  }

  return {
    ...actual,
    SorobanRpc: {
      ...actual.SorobanRpc,
      Server: MockServer,
      assembleTransaction: jest.fn().mockReturnValue({
        build: jest.fn().mockReturnValue({ sign: jest.fn() }),
      }),
      Api: {
        ...actual.SorobanRpc?.Api,
        isSimulationError: jest.fn().mockReturnValue(false),
        GetTransactionStatus: { SUCCESS: 'SUCCESS', FAILED: 'FAILED', NOT_FOUND: 'NOT_FOUND' },
      },
    },
    Horizon: {
      Server: MockHorizonServer,
    },
    Keypair: {
      fromSecret: jest.fn().mockReturnValue({
        publicKey: () => 'GPUBLICKEY',
        sign: jest.fn(),
      }),
    },
    Contract: jest.fn().mockImplementation(() => ({
      call: jest.fn().mockReturnValue({}),
      contractId: jest.fn().mockReturnValue('CCONTRACT123'),
    })),
    TransactionBuilder: jest.fn().mockImplementation(() => ({
      addOperation: jest.fn().mockReturnThis(),
      setTimeout: jest.fn().mockReturnThis(),
      build: jest.fn().mockReturnValue({ sign: jest.fn() }),
    })),
    nativeToScVal: jest.fn().mockReturnValue({}),
    scValToNative: jest.fn().mockReturnValue(BigInt(100)),
    Networks: { TESTNET: 'Test SDF Network ; September 2015', PUBLIC: 'Public Global Stellar Network ; September 2015' },
  };
});

describe('HealthCreditContractService (Soroban testnet integration)', () => {
  let service: HealthCreditContractService;
  let eventEmitter: EventEmitter2;
  let module: TestingModule;

  const { mockSimulateSuccess, mockTxStatus } = buildSorobanStubs();

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        HealthCreditContractService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, def?: string) => {
              const cfg: Record<string, string> = {
                STELLAR_NETWORK: 'testnet',
                STELLAR_SECRET_KEY: 'SCZANGBA5YELQU2LQDRH5JFPKKIA3VGJHPH5VQ6MCZR7PKWQHWKH7YB',
                HEALTH_CREDIT_CONTRACT_ID: 'CCONTRACT123',
                STELLAR_FEE_BUDGET: '10000000',
                STELLAR_MAX_RETRIES: '3',
              };
              return cfg[key] ?? def;
            },
          },
        },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get(HealthCreditContractService);
    eventEmitter = module.get(EventEmitter2);

    // Wire Soroban mock responses
    const StellarSdk = require('@stellar/stellar-sdk');
    const sorobanServer = (service as any).sorobanServer;
    sorobanServer.simulateTransaction.mockResolvedValue(mockSimulateSuccess);
    sorobanServer.sendTransaction.mockResolvedValue({ status: 'PENDING', hash: 'mock-tx-hash-abc123' });
    sorobanServer.getTransaction.mockResolvedValue(mockTxStatus);
  });

  afterEach(() => module.close());

  describe('mint', () => {
    it('invokes the mint contract method and emits a health_credit.issued event', async () => {
      const result = await service.mint('GRECIPIENT', BigInt(500));

      expect(result.txHash).toBe('mock-tx-hash-abc123');
      expect(result.ledger).toBe(12345);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        HealthCreditEventType.ISSUED,
        expect.objectContaining({ toAccountId: 'GRECIPIENT', amount: '500' }),
      );
    });
  });

  describe('transfer', () => {
    it('invokes the transfer contract method and emits a health_credit.transferred event', async () => {
      const result = await service.transfer('GSENDER', 'GRECEIVER', BigInt(200));

      expect(result.txHash).toBeDefined();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        HealthCreditEventType.TRANSFERRED,
        expect.objectContaining({ fromAccountId: 'GSENDER', toAccountId: 'GRECEIVER', amount: '200' }),
      );
    });
  });

  describe('burn', () => {
    it('invokes the burn contract method and emits a health_credit.burned event', async () => {
      const result = await service.burn('GHOLDER', BigInt(50));

      expect(result.txHash).toBeDefined();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        HealthCreditEventType.BURNED,
        expect.objectContaining({ fromAccountId: 'GHOLDER', amount: '50' }),
      );
    });
  });

  describe('getBalance', () => {
    it('returns the credit balance for an account via read-only simulation', async () => {
      const balance = await service.getBalance('GACCOUNT');

      expect(balance.accountId).toBe('GACCOUNT');
      expect(balance.balance).toBeDefined();
      expect(balance.contractId).toBe('CCONTRACT123');
      expect(balance.fetchedAt).toBeInstanceOf(Date);
    });
  });
});
