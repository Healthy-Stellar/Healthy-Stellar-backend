import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { IpfsService, ContentIntegrityError } from './ipfs.service';
import { TracingService } from '../../common/services/tracing.service';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a real CIDv0 (base58btc multihash) for the given payload */
function makeCidV0(payload: string): string {
  const digest = createHash('sha256').update(payload, 'utf8').digest();
  // multihash: [0x12 = sha2-256][0x20 = 32 bytes][digest]
  const multihash = Buffer.concat([Buffer.from([0x12, 0x20]), digest]);

  // base58btc encode
  const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let num = BigInt('0x' + multihash.toString('hex'));
  let encoded = '';
  while (num > 0n) {
    encoded = BASE58[Number(num % 58n)] + encoded;
    num /= 58n;
  }
  for (const byte of multihash) {
    if (byte !== 0) break;
    encoded = '1' + encoded;
  }
  return encoded;
}

/** Build a real CIDv1 (base32, raw multihash) for the given payload */
function makeCidV1Base32(payload: string): string {
  const digest = createHash('sha256').update(payload, 'utf8').digest();
  // CIDv1 bytes: [version=1][codec=0x55 raw][0x12][0x20][digest]
  const cidBytes = Buffer.concat([Buffer.from([0x01, 0x55, 0x12, 0x20]), digest]);

  const BASE32 = 'abcdefghijklmnopqrstuvwxyz234567';
  let bits = 0;
  let value = 0;
  let encoded = '';
  for (const byte of cidBytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      encoded += BASE32[(value >>> (bits - 5)) & 0x1f];
      bits -= 5;
    }
  }
  if (bits > 0) encoded += BASE32[(value << (5 - bits)) & 0x1f];
  return 'b' + encoded; // 'b' = base32lower multibase prefix
}

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockTracingService = {
  withSpan: jest.fn((name: string, fn: (span: any) => any) =>
    fn({ setAttribute: jest.fn() }),
  ),
  addEvent: jest.fn(),
};

function makeConfigService(overrides: Record<string, string> = {}) {
  return {
    get: jest.fn((key: string, def?: string) => overrides[key] ?? def),
  };
}

// ─────────────────────────────────────────────────────────────────────────────

describe('IpfsService', () => {
  let service: IpfsService;

  function buildModule(configOverrides: Record<string, string> = {}) {
    return Test.createTestingModule({
      providers: [
        IpfsService,
        { provide: ConfigService, useValue: makeConfigService(configOverrides) },
        { provide: TracingService, useValue: mockTracingService },
      ],
    }).compile();
  }

  beforeEach(async () => {
    const module: TestingModule = await buildModule({
      IPFS_GATEWAY: 'https://primary.io/ipfs/',
      IPFS_FALLBACK_GATEWAYS: 'https://fallback1.io/ipfs/,https://fallback2.io/ipfs/',
    });
    service = module.get<IpfsService>(IpfsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ── Integrity: CIDv0 ───────────────────────────────────────────────────────

  describe('CIDv0 integrity verification', () => {
    it('returns blob when payload matches CIDv0', async () => {
      const payload = 'encrypted-medical-data';
      const cid = makeCidV0(payload);

      global.fetch = jest.fn().mockResolvedValue({ ok: true, text: jest.fn().mockResolvedValue(payload) });

      const result = await service.fetch(cid);

      expect(result.cid).toBe(cid);
      expect(result.encryptedPayload).toBe(payload);
    });

    it('throws ContentIntegrityError when CIDv0 payload is tampered', async () => {
      const payload = 'real-data';
      const cid = makeCidV0(payload);

      global.fetch = jest.fn().mockResolvedValue({ ok: true, text: jest.fn().mockResolvedValue('tampered-data') });

      await expect(service.fetch(cid)).rejects.toBeInstanceOf(ContentIntegrityError);
    });
  });

  // ── Integrity: CIDv1 ───────────────────────────────────────────────────────

  describe('CIDv1 integrity verification', () => {
    it('returns blob when payload matches CIDv1 base32', async () => {
      const payload = 'v1-encrypted-data';
      const cid = makeCidV1Base32(payload);

      global.fetch = jest.fn().mockResolvedValue({ ok: true, text: jest.fn().mockResolvedValue(payload) });

      const result = await service.fetch(cid);

      expect(result.cid).toBe(cid);
      expect(result.encryptedPayload).toBe(payload);
    });

    it('throws ContentIntegrityError when CIDv1 payload is tampered', async () => {
      const payload = 'v1-real-data';
      const cid = makeCidV1Base32(payload);

      global.fetch = jest.fn().mockResolvedValue({ ok: true, text: jest.fn().mockResolvedValue('v1-tampered') });

      await expect(service.fetch(cid)).rejects.toBeInstanceOf(ContentIntegrityError);
    });
  });

  // ── Fallback gateways ──────────────────────────────────────────────────────

  describe('fallback gateway behaviour', () => {
    it('falls back to secondary gateway when primary returns tampered content', async () => {
      const payload = 'good-data';
      const cid = makeCidV0(payload);

      global.fetch = jest.fn()
        .mockResolvedValueOnce({ ok: true, text: jest.fn().mockResolvedValue('tampered') }) // primary
        .mockResolvedValueOnce({ ok: true, text: jest.fn().mockResolvedValue(payload) });   // fallback1

      const result = await service.fetch(cid);

      expect(result.encryptedPayload).toBe(payload);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('falls back to secondary gateway when primary fetch fails (network error)', async () => {
      const payload = 'good-data';
      const cid = makeCidV0(payload);

      global.fetch = jest.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ ok: true, text: jest.fn().mockResolvedValue(payload) });

      const result = await service.fetch(cid);

      expect(result.encryptedPayload).toBe(payload);
    });

    it('throws ContentIntegrityError when all gateways return tampered content', async () => {
      const payload = 'real';
      const cid = makeCidV0(payload);

      global.fetch = jest.fn().mockResolvedValue({ ok: true, text: jest.fn().mockResolvedValue('tampered') });

      await expect(service.fetch(cid)).rejects.toBeInstanceOf(ContentIntegrityError);
      expect(global.fetch).toHaveBeenCalledTimes(3); // primary + 2 fallbacks
    });

    it('throws last error when all gateways fail with network errors', async () => {
      const cid = makeCidV0('data');

      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      await expect(service.fetch(cid)).rejects.toThrow('Network error');
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });
  });

  // ── HTTP error ─────────────────────────────────────────────────────────────

  it('throws when all gateways return non-ok HTTP response', async () => {
    const cid = makeCidV0('data');

    global.fetch = jest.fn().mockResolvedValue({ ok: false, statusText: 'Not Found' });

    await expect(service.fetch(cid)).rejects.toThrow('IPFS fetch failed: Not Found');
  });

  // ── metadata ───────────────────────────────────────────────────────────────

  it('includes gateway in returned metadata', async () => {
    const payload = 'meta-test';
    const cid = makeCidV0(payload);

    global.fetch = jest.fn().mockResolvedValue({ ok: true, text: jest.fn().mockResolvedValue(payload) });

    const result = await service.fetch(cid);

    expect(result.metadata?.gateway).toBe('https://primary.io/ipfs/');
  });
});
