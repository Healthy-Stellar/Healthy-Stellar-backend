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
 *  2. 5-minute timestamp window — replay window bound
 *  3. Redis-backed nonce deduplication (TTL = maxAge) — replay-safe across restarts and instances
 *  4. Constant-time comparison with length normalisation — timing-safe
 */
@Injectable()
export class WebhookSignatureMiddleware implements NestMiddleware {
  private readonly secret: string;
  private readonly maxAgeMs = 5 * 60 * 1000; // 5 minutes
  private readonly maxAgeSec = 5 * 60;        // Redis TTL in seconds
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

    // 1. Timestamp window check
    const timestamp = parseInt(timestampStr, 10);
    if (isNaN(timestamp) || Date.now() - timestamp > this.maxAgeMs) {
      throw new UnauthorizedException('Webhook signature expired');
    }

    // 2. Redis-backed nonce replay check (SET NX EX — atomic, distributed, TTL-aware)
    const nonceKey = `webhook:nonce:${nonce}`;
    const isNew = await this.redis.set(nonceKey, '1', 'EX', this.maxAgeSec, 'NX');
    if (!isNew) {
      throw new UnauthorizedException('Webhook replay detected');
    }

    // 3. HMAC verification
    const rawBody = (req as any).rawBody ?? '';
    const expectedHex = crypto
      .createHmac('sha256', this.secret)
      .update(`${timestamp}.${rawBody}`)
      .digest('hex');

    // Constant-time comparison — normalise to same length first to avoid
    // the Buffer.from length-mismatch exception in timingSafeEqual.
    const received = Buffer.alloc(expectedHex.length, 0);
    Buffer.from(receivedHex).copy(received, 0, 0, Math.min(receivedHex.length, expectedHex.length));

    if (!crypto.timingSafeEqual(received, Buffer.from(expectedHex))) {
      // Nonce was already stored; remove it so the legitimate sender can retry with a new nonce
      await this.redis.del(nonceKey);
      throw new UnauthorizedException('Invalid webhook signature');
    }

    next();
  }
}
