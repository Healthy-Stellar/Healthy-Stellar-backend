import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';
import Redis from 'ioredis';

/**
 * Inbound webhook security middleware.
 *
 * Header format:  X-Webhook-Signature: <timestampMs>.<nonce>.<hmac-sha256-hex>
 *
 * Protection layers:
 *  1. HMAC-SHA256 over "<timestamp>.<nonce>.<rawBody>" — payload integrity
 *  2. 5-minute timestamp window (both directions, +30s forward skew) — replay window bound
 *  3. Redis-backed nonce deduplication (TTL = maxAge) — replay-safe across restarts and instances
 *  4. Constant-time comparison with strict length check — timing-safe
 */
@Injectable()
export class WebhookSignatureMiddleware implements NestMiddleware {
  private readonly secret: string;
  private readonly maxAgeMs = 5 * 60 * 1000; // 5 minutes
  private readonly maxAgeSec = 5 * 60;        // Redis TTL in seconds
  private readonly maxFutureSkewMs = 30 * 1000; // tolerated forward clock skew
  private readonly redis: Redis;

  constructor(secretEnvVar: string, redisClient?: Redis) {
    const secret = process.env[secretEnvVar];
    if (!secret) {
      throw new Error(`${secretEnvVar} environment variable is required`);
    }
    this.secret = secret;
    this.redis = redisClient ?? new Redis({
      host: process.env.REDIS_HOST ?? 'localhost',
      port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
      password: process.env.REDIS_PASSWORD,
      lazyConnect: true,
    });
  }

  async use(req: Request, res: Response, next: NextFunction) {
    const header = req.headers['x-webhook-signature'] as string;
    if (!header) throw new UnauthorizedException('Missing webhook signature');

    const parts = header.split('.');
    if (parts.length !== 3) throw new UnauthorizedException('Malformed webhook signature');

    const [timestampStr, nonce, receivedHex] = parts;

    // 1. Timestamp window check — reject both stale and future-dated timestamps.
    // A small forward skew (30s) is tolerated for clock drift, but a future
    // timestamp must not be accepted indefinitely (the nonce TTL would otherwise
    // allow replay every maxAge).
    const timestamp = parseInt(timestampStr, 10);
    if (isNaN(timestamp)) {
      throw new UnauthorizedException('Webhook signature expired');
    }
    const age = Date.now() - timestamp;
    if (age > this.maxAgeMs || -age > this.maxAgeMs + this.maxFutureSkewMs) {
      throw new UnauthorizedException('Webhook signature expired');
    }

    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
    if (!Buffer.isBuffer(rawBody)) {
      throw new UnauthorizedException('Raw webhook body unavailable');
    }

    // 2. Redis-backed nonce replay check (SET NX EX — atomic, distributed, TTL-aware)
    const nonceKey = `webhook:nonce:${nonce}`;
    const isNew = await this.redis.set(nonceKey, '1', 'EX', this.maxAgeSec, 'NX');
    if (!isNew) {
      throw new UnauthorizedException('Webhook replay detected');
    }

    // 3. HMAC verification — payload includes nonce to prevent replay bypass
    const payload = Buffer.concat([Buffer.from(`${timestamp}.${nonce}.`), rawBody]);
    const expectedHex = crypto
      .createHmac('sha256', this.secret)
      .update(payload)
      .digest('hex');

    // Constant-time comparison — reject length mismatches outright so that
    // "<valid-hmac><junk>" is not silently truncated and accepted.
    const expectedBuf = Buffer.from(expectedHex);
    const receivedBuf = Buffer.from(receivedHex);
    if (receivedBuf.length !== expectedBuf.length) {
      await this.redis.del(nonceKey);
      throw new UnauthorizedException('Invalid webhook signature');
    }

    if (!crypto.timingSafeEqual(receivedBuf, expectedBuf)) {
      // Nonce was already stored; remove it so the legitimate sender can retry with a new nonce
      await this.redis.del(nonceKey);
      throw new UnauthorizedException('Invalid webhook signature');
    }

    next();
  }
}
