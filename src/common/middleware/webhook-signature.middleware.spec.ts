import { WebhookSignatureMiddleware } from './webhook-signature.middleware';
import { UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';

const IPFS_SECRET = 'ipfs-test-secret';
const STELLAR_SECRET = 'stellar-test-secret';
const SECRET_ENV = 'IPFS_WEBHOOK_SECRET';

/**
 * Build a valid X-Webhook-Signature header: <timestamp>.<nonce>.<hmac-sha256>
 * Payload signed: "<timestamp>.<nonce>.<rawBody>"
 */
function sign(
  body: string,
  secret: string,
  timestamp = Date.now(),
  nonce = crypto.randomBytes(16).toString('hex'),
): { header: string; timestamp: number; nonce: string } {
  const payload = `${timestamp}.${nonce}.${body}`;
  const hmac = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return { header: `${timestamp}.${nonce}.${hmac}`, timestamp, nonce };
}

/** Build a mock Express request */
function makeReq(header: string | undefined, body = '{}'): any {
  return {
    headers: header !== undefined ? { 'x-webhook-signature': header } : {},
    rawBody: body,
  };
}

/** Minimal Redis mock — SET NX always succeeds (new nonce), GET/DEL are no-ops */
function makeRedisMock(setNxResult: string | null = '1') {
  return {
    set: jest.fn().mockResolvedValue(setNxResult),
    del: jest.fn().mockResolvedValue(1),
  } as any;
}

describe('WebhookSignatureMiddleware', () => {
  let middleware: WebhookSignatureMiddleware;
  let redisMock: ReturnType<typeof makeRedisMock>;

  beforeEach(() => {
    process.env[SECRET_ENV] = IPFS_SECRET;
    redisMock = makeRedisMock();
    middleware = new WebhookSignatureMiddleware(SECRET_ENV, redisMock);
  });

  afterEach(() => {
    delete process.env[SECRET_ENV];
    delete process.env['STELLAR_WEBHOOK_SECRET'];
  });

  // ── Construction ──────────────────────────────────────────────────────────

  it('throws on construction when env var is missing', () => {
    delete process.env[SECRET_ENV];
    expect(() => new WebhookSignatureMiddleware(SECRET_ENV, redisMock)).toThrow(
      `${SECRET_ENV} environment variable is required`,
    );
  });

  it('constructs successfully when env var is present', () => {
    expect(() => new WebhookSignatureMiddleware(SECRET_ENV, redisMock)).not.toThrow();
  });

  // ── Valid signature ───────────────────────────────────────────────────────

  it('calls next() for a valid signature', async () => {
    const body = JSON.stringify({ event: 'pin.added' });
    const { header } = sign(body, IPFS_SECRET);
    const next = jest.fn();

    await middleware.use(makeReq(header, body), {} as any, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('uses rawBody bytes (not re-parsed JSON) for HMAC', async () => {
    const rawBody = '{ "event" :  "pin.added" }';
    const { header } = sign(rawBody, IPFS_SECRET);
    const next = jest.fn();

    await middleware.use(makeReq(header, rawBody), {} as any, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('falls back to empty string when rawBody is absent', async () => {
    const { header } = sign('', IPFS_SECRET);
    const req = { headers: { 'x-webhook-signature': header } }; // no rawBody
    const next = jest.fn();

    await middleware.use(req as any, {} as any, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  // ── Missing / malformed header ────────────────────────────────────────────

  it('throws 401 when X-Webhook-Signature header is absent', async () => {
    await expect(middleware.use(makeReq(undefined), {} as any, jest.fn())).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('throws 401 when header has only 2 parts (old format without nonce)', async () => {
    const ts = Date.now();
    const hmac = crypto.createHmac('sha256', IPFS_SECRET).update(`${ts}.{}`).digest('hex');
    await expect(
      middleware.use(makeReq(`${ts}.${hmac}`), {} as any, jest.fn()),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('throws 401 when header has more than 3 parts', async () => {
    await expect(
      middleware.use(makeReq('a.b.c.d'), {} as any, jest.fn()),
    ).rejects.toThrow(UnauthorizedException);
  });

  // ── Timestamp window ──────────────────────────────────────────────────────

  it('throws 401 for a timestamp older than 5 minutes', async () => {
    const body = '{}';
    const staleTs = Date.now() - 6 * 60 * 1000;
    const { header } = sign(body, IPFS_SECRET, staleTs);

    await expect(middleware.use(makeReq(header, body), {} as any, jest.fn())).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('throws 401 for a non-numeric timestamp', async () => {
    const nonce = crypto.randomBytes(8).toString('hex');
    const hmac = crypto.createHmac('sha256', IPFS_SECRET).update(`NaN.${nonce}.{}`).digest('hex');

    await expect(
      middleware.use(makeReq(`NaN.${nonce}.${hmac}`), {} as any, jest.fn()),
    ).rejects.toThrow(UnauthorizedException);
  });

  // ── Nonce replay protection ───────────────────────────────────────────────

  it('throws 401 when nonce has already been used (replay detected)', async () => {
    const body = '{}';
    const { header } = sign(body, IPFS_SECRET);
    // Redis SET NX returns null → nonce already exists
    redisMock.set.mockResolvedValue(null);

    await expect(middleware.use(makeReq(header, body), {} as any, jest.fn())).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('cleans up the nonce from Redis when HMAC verification fails', async () => {
    const body = '{}';
    const ts = Date.now();
    const nonce = crypto.randomBytes(8).toString('hex');
    // Sign with wrong secret so HMAC check fails after nonce is stored
    const wrongHmac = crypto
      .createHmac('sha256', 'wrong-secret')
      .update(`${ts}.${nonce}.${body}`)
      .digest('hex');

    await expect(
      middleware.use(makeReq(`${ts}.${nonce}.${wrongHmac}`, body), {} as any, jest.fn()),
    ).rejects.toThrow(UnauthorizedException);

    expect(redisMock.del).toHaveBeenCalledWith(`webhook:nonce:${nonce}`);
  });

  // ── HMAC secret verification ──────────────────────────────────────────────

  it('throws 401 when signed with the wrong secret', async () => {
    const body = JSON.stringify({ event: 'pin.added' });
    const { header } = sign(body, 'wrong-secret');

    await expect(middleware.use(makeReq(header, body), {} as any, jest.fn())).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('throws 401 when body is tampered after signing', async () => {
    const originalBody = '{"event":"pin.added"}';
    const { header } = sign(originalBody, IPFS_SECRET);
    const tamperedBody = '{"event":"pin.added","inject":true}';

    await expect(
      middleware.use(makeReq(header, tamperedBody), {} as any, jest.fn()),
    ).rejects.toThrow(UnauthorizedException);
  });

  // ── BUG #494: nonce must be included in HMAC payload ─────────────────────

  it('should include nonce in HMAC payload [BUG #494]', async () => {
    // This test documents that the nonce MUST be part of the signed payload.
    // If the nonce were excluded (the bug in #494), an attacker could craft a
    // valid HMAC over "<timestamp>.<body>" and substitute any nonce — effectively
    // replaying the request with a fresh nonce each time.
    //
    // The test verifies that a header signed WITHOUT the nonce is rejected even
    // when the timestamp and body are identical to a legitimately signed request.
    const body = '{"event":"payment"}';
    const ts = Date.now();
    const nonce = crypto.randomBytes(8).toString('hex');

    // Signature computed WITHOUT nonce (bug scenario: payload = `${ts}.${body}`)
    const buggyHmac = crypto
      .createHmac('sha256', IPFS_SECRET)
      .update(`${ts}.${body}`)
      .digest('hex');
    const buggyHeader = `${ts}.${nonce}.${buggyHmac}`;

    await expect(
      middleware.use(makeReq(buggyHeader, body), {} as any, jest.fn()),
    ).rejects.toThrow(UnauthorizedException);
  });

  // ── Per-endpoint secret isolation ─────────────────────────────────────────

  it('IPFS middleware rejects a payload signed with the Stellar secret', async () => {
    const body = JSON.stringify({ tx: 'abc' });
    const { header } = sign(body, STELLAR_SECRET);

    await expect(middleware.use(makeReq(header, body), {} as any, jest.fn())).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('Stellar middleware accepts a payload signed with the Stellar secret', async () => {
    process.env['STELLAR_WEBHOOK_SECRET'] = STELLAR_SECRET;
    const stellarMiddleware = new WebhookSignatureMiddleware('STELLAR_WEBHOOK_SECRET', redisMock);
    const body = JSON.stringify({ tx: 'abc' });
    const { header } = sign(body, STELLAR_SECRET);
    const next = jest.fn();

    await stellarMiddleware.use(makeReq(header, body), {} as any, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('Stellar middleware rejects a payload signed with the IPFS secret', async () => {
    process.env['STELLAR_WEBHOOK_SECRET'] = STELLAR_SECRET;
    const stellarMiddleware = new WebhookSignatureMiddleware('STELLAR_WEBHOOK_SECRET', redisMock);
    const body = JSON.stringify({ tx: 'abc' });
    const { header } = sign(body, IPFS_SECRET);

    await expect(stellarMiddleware.use(makeReq(header, body), {} as any, jest.fn())).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
