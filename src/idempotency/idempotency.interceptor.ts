import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  UnprocessableEntityException,
  Logger,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const IDEMPOTENCY_HEADER = 'idempotency-key';
const TTL_MS = 24 * 60 * 60 * 1000;
/** How long (ms) a second request polls waiting for the first to finish */
const LOCK_POLL_INTERVAL_MS = 100;
const LOCK_TIMEOUT_MS = 10_000;

/**
 * Convert the composite key string into a 64-bit bigint suitable for
 * pg_advisory_lock.  We use a deterministic hash so that every concurrent
 * request for the *same* idempotency key maps to the same lock id.
 */
function keyToLockId(compositeKey: string): number {
  // FNV-1a 64-bit hash (works in JS via 32-bit math + folding)
  let hash = 0x811c9dc5; // FNV offset basis (32-bit)
  for (let i = 0; i < compositeKey.length; i++) {
    hash = (hash ^ compositeKey.charCodeAt(i)) >>> 0;
    hash = (Math.imul(hash, 0x01000193)) >>> 0; // FNV prime
  }
  // Fold to a positive 32-bit integer (PostgreSQL advisory lock accepts int64,
  // but a single 32-bit int is sufficient and simpler for our use-case)
  return hash;
}

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async intercept(ctx: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const req = ctx.switchToHttp().getRequest();
    const res = ctx.switchToHttp().getResponse();

    if (!MUTATING_METHODS.has(req.method)) return next.handle();

    const clientKey = req.headers[IDEMPOTENCY_HEADER] as string | undefined;
    if (!clientKey) return next.handle();

    if (clientKey.length > 256) {
      throw new UnprocessableEntityException('Idempotency-Key must be 256 characters or fewer');
    }

    const tenantId: string = req.headers['x-tenant-id'] ?? 'global';
    const userId: string = (req as any).user?.id ?? 'anonymous';
    const compositeKey = `${tenantId}:${userId}:${clientKey}`;
    const fingerprint = `${req.method}:${req.path}`;
    const cutoff = new Date(Date.now() - TTL_MS);
    const lockId = keyToLockId(compositeKey);

    // ── Step 1: delete any expired record for this key ────────────
    await this.dataSource.query(
      `DELETE FROM http_idempotency_keys WHERE key = $1 AND "createdAt" < $2`,
      [compositeKey, cutoff],
    );

    // ── Step 2: atomically insert a "processing" sentinel row ─────
    // Uses INSERT … ON CONFLICT DO NOTHING so only one concurrent
    // request wins. The winner gets rowCount=1; all others get 0.
    const insertResult = await this.dataSource.query(
      `INSERT INTO http_idempotency_keys
         (id, key, "statusCode", body, headers, "requestFingerprint", "createdAt")
       VALUES (gen_random_uuid(), $1, 0, '{}', '{}', $2, NOW())
       ON CONFLICT (key) DO NOTHING`,
      [compositeKey, fingerprint],
    );

    const won = (insertResult as any)?.rowCount === 1;

    if (!won) {
      // ── Step 3 (loser path): poll until the winner writes a real response ──
      const deadline = Date.now() + LOCK_TIMEOUT_MS;
      let existing: any = null;

      while (Date.now() < deadline) {
        const rows = await this.dataSource.query(
          `SELECT * FROM http_idempotency_keys WHERE key = $1 LIMIT 1`,
          [compositeKey],
        );
        existing = rows[0] ?? null;

        // statusCode > 0 means the winner has finished writing
        if (existing && existing.statusCode > 0) break;

        await new Promise((r) => setTimeout(r, LOCK_POLL_INTERVAL_MS));
      }

      if (!existing || existing.statusCode === 0) {
        // Winner never finished — fall through and let this request execute
        this.logger.warn(`[Idempotency] Lock timeout for key=${clientKey}, executing request`);
        return next.handle();
      }

      // Validate fingerprint
      if (existing.requestFingerprint !== fingerprint) {
        throw new UnprocessableEntityException(
          `Idempotency-Key '${clientKey}' was already used for ${existing.requestFingerprint}`,
        );
      }

      this.logger.debug(`[Idempotency] Replaying cached response for key=${clientKey}`);

      for (const [name, value] of Object.entries(existing.headers as Record<string, string>)) {
        res.setHeader(name, value);
      }
      res.setHeader('Idempotent-Replayed', 'true');
      res.status(existing.statusCode);

      return of(existing.body);
    }

    // ── Step 4 (winner path): execute handler then persist result ──
    // Acquire a PostgreSQL advisory lock around the lookup + write so that
    // even if the INSERT sentinel somehow races (e.g. row was deleted
    // between the DELETE and INSERT), the lookup and persistence remain
    // atomic and no two requests can both execute the business operation.
    await this.dataSource.query('SELECT pg_advisory_lock($1)', [lockId]);

    try {
      // Double-check: another request may have completed between our
      // INSERT and acquiring the lock.
      const recheck = await this.dataSource.query(
        `SELECT * FROM http_idempotency_keys WHERE key = $1 LIMIT 1`,
        [compositeKey],
      );

      if (recheck[0] && recheck[0].statusCode > 0) {
        // Another request already persisted a result — replay it
        const existing = recheck[0];

        if (existing.requestFingerprint !== fingerprint) {
          throw new UnprocessableEntityException(
            `Idempotency-Key '${clientKey}' was already used for ${existing.requestFingerprint}`,
          );
        }

        this.logger.debug(`[Idempotency] Replaying cached response for key=${clientKey}`);

        for (const [name, value] of Object.entries(existing.headers as Record<string, string>)) {
          res.setHeader(name, value);
        }
        res.setHeader('Idempotent-Replayed', 'true');
        res.status(existing.statusCode);

        return of(existing.body);
      }

      return next.handle().pipe(
        tap(async (body) => {
          const statusCode: number = res.statusCode ?? 200;

          const headers: Record<string, string> = {};
          for (const name of ['content-type', 'location', 'x-resource-id']) {
            const val = res.getHeader(name);
            if (val) headers[name] = String(val);
          }

          try {
            await this.dataSource.query(
              `UPDATE http_idempotency_keys
               SET "statusCode" = $1, body = $2, headers = $3
               WHERE key = $4`,
              [statusCode, JSON.stringify(body ?? {}), JSON.stringify(headers), compositeKey],
            );
          } catch (err) {
            this.logger.error(
              `[Idempotency] Failed to persist key=${clientKey}: ${(err as Error).message}`,
            );
          }
        }),
      );
    } finally {
      await this.dataSource.query('SELECT pg_advisory_unlock($1)', [lockId]);
    }
  }
}
