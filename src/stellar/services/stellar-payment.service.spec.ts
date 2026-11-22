jest.unmock('@stellar/stellar-sdk');

import * as StellarSdk from '@stellar/stellar-sdk';
import { ConfigService } from '@nestjs/config';
import { StellarService, StellarPaymentError } from './stellar.service';
import { StellarPaymentService } from './stellar-payment.service';
import { CircuitBreakerService } from '../../common/circuit-breaker/circuit-breaker.service';
import { StellarTracingService } from './stellar-tracing.service';
import { MultiSigTransactionEntity } from '../entities/multi-sig-transaction.entity';

const source = StellarSdk.Keypair.random();
const destination = StellarSdk.Keypair.random().publicKey();
const issuer = StellarSdk.Keypair.random().publicKey();

function horizonError(resultCodes: { transaction?: string; operations?: string[] }) {
  return Object.assign(new Error('Request failed with status code 400'), {
    response: { status: 400, data: { extras: { result_codes: resultCodes } } },
  });
}

function createStellarService() {
  const config = {
    get: jest.fn((key: string, def?: string) => {
      const values: { [k: string]: string } = {
        STELLAR_NETWORK: 'testnet',
        STELLAR_SECRET_KEY: source.secret(),
        STELLAR_CONTRACT_ID: 'CTESTCONTRACT',
      };
      return values[key] ?? def;
    }),
  } as unknown as ConfigService;
  const tracing = {
    traceHorizonCall: jest.fn((_op: string, _attrs: unknown, fn: () => Promise<unknown>) => fn()),
  } as unknown as StellarTracingService;

  const service = new StellarService(config, {} as CircuitBreakerService, tracing);

  const transactionCall = jest.fn().mockRejectedValue(new Error('404 Not Found'));
  const horizon = {
    loadAccount: jest.fn(async (id: string) => new StellarSdk.Account(id, '100')),
    submitTransaction: jest.fn(),
    transactions: jest.fn(() => ({ transaction: () => ({ call: transactionCall }) })),
  };
  (service as any).horizonServer = horizon;

  return { service, horizon, transactionCall };
}

describe('StellarService classic payments', () => {
  let service: StellarService;
  let horizon: ReturnType<typeof createStellarService>['horizon'];
  let transactionCall: jest.Mock;

  beforeEach(() => {
    ({ service, horizon, transactionCall } = createStellarService());
  });

  describe('buildPaymentTransaction', () => {
    it('builds and signs a native XLM payment from the source account', async () => {
      const { xdr, hash } = await service.buildPaymentTransaction({
        destination,
        amount: '15000',
        asset: 'XLM',
        memo: 'invoice 42',
      });

      const tx = StellarSdk.TransactionBuilder.fromXDR(xdr, StellarSdk.Networks.TESTNET) as StellarSdk.Transaction;
      expect(tx.source).toBe(source.publicKey());
      expect(tx.hash().toString('hex')).toBe(hash);
      expect(tx.memo.value?.toString()).toBe('invoice 42');
      expect(tx.operations).toHaveLength(1);
      const op = tx.operations[0] as StellarSdk.Operation.Payment;
      expect(op.type).toBe('payment');
      expect(op.destination).toBe(destination);
      expect(op.amount).toBe('15000.0000000');
      expect(op.asset.isNative()).toBe(true);
      expect(source.verify(tx.hash(), tx.signatures[0].signature())).toBe(true);
    });

    it('supports issued assets in CODE:ISSUER form', async () => {
      const { xdr } = await service.buildPaymentTransaction({ destination, amount: '1.5', asset: `USDC:${issuer}` });

      const tx = StellarSdk.TransactionBuilder.fromXDR(xdr, StellarSdk.Networks.TESTNET) as StellarSdk.Transaction;
      const op = tx.operations[0] as StellarSdk.Operation.Payment;
      expect(op.asset.getCode()).toBe('USDC');
      expect(op.asset.getIssuer()).toBe(issuer);
    });

    it.each([
      ['an invalid destination', { destination: 'GBAD', amount: '1' }, 'Invalid destination'],
      ['a non-numeric amount', { destination, amount: 'lots' }, 'Invalid amount'],
      ['a zero amount', { destination, amount: '0' }, 'Invalid amount'],
      ['too many decimals', { destination, amount: '1.123456789' }, 'Invalid amount'],
      ['a malformed asset', { destination, amount: '1', asset: 'USDC:not-an-issuer' }, 'invalid asset'],
      ['an over-long memo', { destination, amount: '1', memo: 'x'.repeat(29) }, 'Invalid memo'],
    ])('rejects %s with a non-retryable error', async (_label, params, message) => {
      const err = await service.buildPaymentTransaction(params).catch((e) => e);
      expect(err).toBeInstanceOf(StellarPaymentError);
      expect(err.retryable).toBe(false);
      expect(err.message).toContain(message);
      expect(horizon.submitTransaction).not.toHaveBeenCalled();
    });
  });

  describe('submitSignedTransaction', () => {
    let signed: { xdr: string; hash: string };

    beforeEach(async () => {
      signed = await service.buildPaymentTransaction({ destination, amount: '10' });
    });

    it('returns the hash Horizon reports', async () => {
      horizon.submitTransaction.mockResolvedValue({ hash: signed.hash, ledger: 7, successful: true });

      await expect(service.submitSignedTransaction(signed.xdr)).resolves.toBe(signed.hash);
    });

    it('maps op_underfunded to a terminal "insufficient funds" error', async () => {
      horizon.submitTransaction.mockRejectedValue(
        horizonError({ transaction: 'tx_failed', operations: ['op_underfunded'] }),
      );

      const err = await service.submitSignedTransaction(signed.xdr).catch((e) => e);
      expect(err).toBeInstanceOf(StellarPaymentError);
      expect(err.retryable).toBe(false);
      expect(err.code).toBe('op_underfunded');
      expect(err.message).toContain('insufficient funds');
    });

    it('maps op_no_destination to a terminal "Invalid destination" error', async () => {
      horizon.submitTransaction.mockRejectedValue(
        horizonError({ transaction: 'tx_failed', operations: ['op_no_destination'] }),
      );

      const err = await service.submitSignedTransaction(signed.xdr).catch((e) => e);
      expect(err.retryable).toBe(false);
      expect(err.message).toContain('Invalid destination');
    });

    it('reports tx_too_late as retryable with its code', async () => {
      horizon.submitTransaction.mockRejectedValue(horizonError({ transaction: 'tx_too_late' }));

      const err = await service.submitSignedTransaction(signed.xdr).catch((e) => e);
      expect(err.retryable).toBe(true);
      expect(err.code).toBe('tx_too_late');
    });

    it('treats a lost response as success when the transaction is already on the ledger', async () => {
      horizon.submitTransaction.mockRejectedValue(new Error('socket hang up'));
      transactionCall.mockResolvedValue({ hash: signed.hash, successful: true });

      await expect(service.submitSignedTransaction(signed.xdr)).resolves.toBe(signed.hash);
    });

    it('reports transport failures as retryable when the transaction did not land', async () => {
      horizon.submitTransaction.mockRejectedValue(new Error('socket hang up'));

      const err = await service.submitSignedTransaction(signed.xdr).catch((e) => e);
      expect(err).toBeInstanceOf(StellarPaymentError);
      expect(err.retryable).toBe(true);
    });
  });

  it('sendPayment builds, signs and submits, returning the hash', async () => {
    horizon.submitTransaction.mockImplementation(async (tx: StellarSdk.Transaction) => ({
      hash: tx.hash().toString('hex'),
      ledger: 1,
      successful: true,
    }));

    const hash = await service.sendPayment({ destination, amount: '25' });

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(horizon.submitTransaction).toHaveBeenCalledTimes(1);
  });
});

describe('StellarPaymentService', () => {
  const stellar = {
    buildPaymentTransaction: jest.fn(),
    submitSignedTransaction: jest.fn(),
  };
  const service = new StellarPaymentService(stellar as unknown as StellarService);
  const tx = {
    id: 'tx-1',
    destination,
    amount: '15000',
    asset: 'XLM',
    memo: 'memo',
    xdr: null,
  } as unknown as MultiSigTransactionEntity;

  beforeEach(() => {
    jest.resetAllMocks();
    stellar.buildPaymentTransaction.mockResolvedValue({ xdr: 'new-xdr', hash: 'h1' });
    stellar.submitSignedTransaction.mockResolvedValue('h1');
  });

  it('builds, persists, then submits a new envelope', async () => {
    const persist = jest.fn().mockResolvedValue(undefined);

    await expect(service.executePayment(tx, persist)).resolves.toBe('h1');

    expect(stellar.buildPaymentTransaction).toHaveBeenCalledWith({
      destination,
      amount: '15000',
      asset: 'XLM',
      memo: 'memo',
    });
    expect(persist).toHaveBeenCalledWith('new-xdr');
    expect(persist.mock.invocationCallOrder[0]).toBeLessThan(
      stellar.submitSignedTransaction.mock.invocationCallOrder[0],
    );
    expect(stellar.submitSignedTransaction).toHaveBeenCalledWith('new-xdr');
  });

  it('resubmits a stored envelope instead of building a second payment', async () => {
    await expect(service.executePayment({ ...tx, xdr: 'stored-xdr' } as MultiSigTransactionEntity)).resolves.toBe('h1');

    expect(stellar.submitSignedTransaction).toHaveBeenCalledWith('stored-xdr');
    expect(stellar.buildPaymentTransaction).not.toHaveBeenCalled();
  });

  it('rebuilds only when the stored envelope expired before landing', async () => {
    stellar.submitSignedTransaction
      .mockRejectedValueOnce(new StellarPaymentError('too late', true, 'tx_too_late'))
      .mockResolvedValueOnce('h2');
    const persist = jest.fn().mockResolvedValue(undefined);

    await expect(
      service.executePayment({ ...tx, xdr: 'stale-xdr' } as MultiSigTransactionEntity, persist),
    ).resolves.toBe('h2');

    expect(stellar.buildPaymentTransaction).toHaveBeenCalledTimes(1);
    expect(persist).toHaveBeenCalledWith('new-xdr');
    expect(stellar.submitSignedTransaction).toHaveBeenLastCalledWith('new-xdr');
  });

  it('propagates other failures of a stored envelope without rebuilding', async () => {
    stellar.submitSignedTransaction.mockRejectedValue(new StellarPaymentError('horizon 503', true));

    await expect(
      service.executePayment({ ...tx, xdr: 'stored-xdr' } as MultiSigTransactionEntity),
    ).rejects.toThrow('horizon 503');
    expect(stellar.buildPaymentTransaction).not.toHaveBeenCalled();
  });
});
