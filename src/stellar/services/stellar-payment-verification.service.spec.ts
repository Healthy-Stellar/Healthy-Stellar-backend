import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { getRepositoryToken } from '@nestjs/typeorm';
import { of, throwError } from 'rxjs';
import { HttpIdempotencyEntity } from '../../idempotency/idempotency.entity';
import {
  StellarPaymentVerificationService,
  PaymentVerificationStatus,
  PAYMENT_CONFIRMED_EVENT,
} from './stellar-payment-verification.service';

const TX_HASH = 'abc123def456';

/** Returns a fresh date string that is within the 24-h expiry window. */
const recentDate = () => new Date(Date.now() - 60_000).toISOString();

/** Returns a date string older than the 24-h expiry window. */
const expiredDate = () => new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();

const horizonOk = (overrides: Partial<any> = {}) => ({
  data: {
    successful:  true,
    ledger:      123456,
    created_at:  recentDate(),
    result_xdr:  undefined,
    ...overrides,
  },
});

describe('StellarPaymentVerificationService', () => {
  let service: StellarPaymentVerificationService;
  let httpService: HttpService;
  let eventEmitter: EventEmitter2;
  let idempotencyRepo: any;

  beforeEach(async () => {
    idempotencyRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      upsert:  jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StellarPaymentVerificationService,
        {
          provide: HttpService,
          useValue: { get: jest.fn() },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn((key: string, def: any) => def) },
        },
        {
          provide: EventEmitter2,
          useValue: { emit: jest.fn() },
        },
        {
          provide: getRepositoryToken(HttpIdempotencyEntity),
          useValue: idempotencyRepo,
        },
      ],
    }).compile();

    service       = module.get(StellarPaymentVerificationService);
    httpService   = module.get(HttpService);
    eventEmitter  = module.get(EventEmitter2);
  });

  // ── Confirmed payment ────────────────────────────────────────────────────────

  it('returns CONFIRMED for a successful on-chain transaction', async () => {
    (httpService.get as jest.Mock).mockReturnValue(of(horizonOk()));

    const result = await service.verifyPayment(TX_HASH, 'tenant-1');

    expect(result.status).toBe(PaymentVerificationStatus.CONFIRMED);
    expect(result.txHash).toBe(TX_HASH);
    expect(result.ledger).toBe(123456);
    expect(result.confirmedAt).toBeDefined();
  });

  it('persists an idempotency record on CONFIRMED', async () => {
    (httpService.get as jest.Mock).mockReturnValue(of(horizonOk()));

    await service.verifyPayment(TX_HASH);

    expect(idempotencyRepo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ key: `payment:verify:${TX_HASH}` }),
      ['key'],
    );
  });

  it('emits payment.confirmed domain event on CONFIRMED', async () => {
    (httpService.get as jest.Mock).mockReturnValue(of(horizonOk()));

    await service.verifyPayment(TX_HASH, 'tenant-1');

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      PAYMENT_CONFIRMED_EVENT,
      expect.objectContaining({ txHash: TX_HASH, ledger: 123456, tenantId: 'tenant-1' }),
    );
  });

  // ── Failed payment ───────────────────────────────────────────────────────────

  it('returns FAILED for a transaction that failed on-chain', async () => {
    (httpService.get as jest.Mock).mockReturnValue(
      of(horizonOk({ successful: false, result_xdr: 'AAAAAAAAAGU=' })),
    );

    const result = await service.verifyPayment(TX_HASH);

    expect(result.status).toBe(PaymentVerificationStatus.FAILED);
    expect(result.errorMessage).toBe('AAAAAAAAAGU=');
  });

  it('does NOT emit domain event on FAILED', async () => {
    (httpService.get as jest.Mock).mockReturnValue(
      of(horizonOk({ successful: false })),
    );

    await service.verifyPayment(TX_HASH);

    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  // ── Pending payment ──────────────────────────────────────────────────────────

  it('returns PENDING when Horizon responds with 404', async () => {
    const err: any = new Error('Not Found');
    err.response  = { status: 404 };
    (httpService.get as jest.Mock).mockReturnValue(throwError(() => err));

    const result = await service.verifyPayment(TX_HASH);

    expect(result.status).toBe(PaymentVerificationStatus.PENDING);
    expect(result.txHash).toBe(TX_HASH);
  });

  it('does NOT persist idempotency record for PENDING', async () => {
    const err: any = new Error('Not Found');
    err.response  = { status: 404 };
    (httpService.get as jest.Mock).mockReturnValue(throwError(() => err));

    await service.verifyPayment(TX_HASH);

    expect(idempotencyRepo.upsert).not.toHaveBeenCalled();
  });

  // ── Expired payment ──────────────────────────────────────────────────────────

  it('returns EXPIRED for a successful but old transaction', async () => {
    (httpService.get as jest.Mock).mockReturnValue(
      of(horizonOk({ created_at: expiredDate() })),
    );

    const result = await service.verifyPayment(TX_HASH);

    expect(result.status).toBe(PaymentVerificationStatus.EXPIRED);
    expect(result.errorMessage).toContain('expiry');
  });

  it('does NOT emit domain event on EXPIRED', async () => {
    (httpService.get as jest.Mock).mockReturnValue(
      of(horizonOk({ created_at: expiredDate() })),
    );

    await service.verifyPayment(TX_HASH);

    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  // ── Idempotency (duplicate) ──────────────────────────────────────────────────

  it('returns DUPLICATE without calling Horizon when record already exists', async () => {
    idempotencyRepo.findOne.mockResolvedValue({
      key:        `payment:verify:${TX_HASH}`,
      body:       { txHash: TX_HASH, status: PaymentVerificationStatus.CONFIRMED, ledger: 99 },
      statusCode: 200,
    });

    const result = await service.verifyPayment(TX_HASH);

    expect(result.status).toBe(PaymentVerificationStatus.DUPLICATE);
    expect(result.ledger).toBe(99);
    expect(httpService.get).not.toHaveBeenCalled();
  });

  // ── Error propagation ────────────────────────────────────────────────────────

  it('rethrows unexpected Horizon errors (non-404)', async () => {
    const err: any = new Error('Internal Server Error');
    err.response  = { status: 500 };
    (httpService.get as jest.Mock).mockReturnValue(throwError(() => err));

    await expect(service.verifyPayment(TX_HASH)).rejects.toThrow('Internal Server Error');
    expect(idempotencyRepo.upsert).not.toHaveBeenCalled();
  });

  // ── tenantId forwarding ──────────────────────────────────────────────────────

  it('forwards tenantId in the domain event', async () => {
    (httpService.get as jest.Mock).mockReturnValue(of(horizonOk()));

    await service.verifyPayment(TX_HASH, 'my-tenant');

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      PAYMENT_CONFIRMED_EVENT,
      expect.objectContaining({ tenantId: 'my-tenant' }),
    );
  });

  it('sets tenantId to undefined when not provided', async () => {
    (httpService.get as jest.Mock).mockReturnValue(of(horizonOk()));

    await service.verifyPayment(TX_HASH);

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      PAYMENT_CONFIRMED_EVENT,
      expect.objectContaining({ tenantId: undefined }),
    );
  });

  // ── Horizon URL selection ────────────────────────────────────────────────────

  it('uses testnet Horizon URL by default', async () => {
    (httpService.get as jest.Mock).mockReturnValue(of(horizonOk()));

    await service.verifyPayment(TX_HASH);

    expect(httpService.get).toHaveBeenCalledWith(
      expect.stringContaining('horizon-testnet.stellar.org'),
    );
  });

  it('uses mainnet Horizon URL when STELLAR_NETWORK=mainnet', async () => {
    const mainnetModule = await Test.createTestingModule({
      providers: [
        StellarPaymentVerificationService,
        {
          provide: HttpService,
          useValue: { get: jest.fn().mockReturnValue(of(horizonOk())) },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn((key: string, def: any) => (key === 'STELLAR_NETWORK' ? 'mainnet' : def)) },
        },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: getRepositoryToken(HttpIdempotencyEntity), useValue: idempotencyRepo },
      ],
    }).compile();

    const mainnetService  = mainnetModule.get(StellarPaymentVerificationService);
    const mainnetHttp     = mainnetModule.get(HttpService);
    await mainnetService.verifyPayment(TX_HASH);

    expect(mainnetHttp.get).toHaveBeenCalledWith(
      expect.stringContaining('horizon.stellar.org/transactions'),
    );
    expect(mainnetHttp.get).not.toHaveBeenCalledWith(
      expect.stringContaining('horizon-testnet'),
    );
  });
});
