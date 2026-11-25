import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  UnprocessableEntityException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { Observable, of, firstValueFrom } from 'rxjs';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { DataSource, QueryRunner, Repository } from 'typeorm';
import { createHash } from 'crypto';
import { HttpIdempotencyEntity } from './idempotency.entity';
import { TenantContext } from '../tenant/context/tenant.context';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const IDEMPOTENCY_HEADER = 'idempotency-key';
const TTL_MS = 24 * 60 * 60 * 1000;
// shortcut: a claim left behind by a crashed request is reclaimed after this; a handler slower than this could run twice
const IN_PROGRESS_TTL_MS = 5 * 60 * 1000;
// statusCode sentinel for a claimed-but-unfinished request (0 is never a valid HTTP status)
const IN_PROGRESS = 0;
const LOCK_TIMEOUT_MS = 5_000;
const LOCK_RETRY_INTERVAL_MS = 50;

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);

  constructor(
    @InjectRepository(HttpIdempotencyEntity)
    private readonly repo: Repository<HttpIdempotencyEntity>,
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

    // Principal is populated by JwtAuthGuard; tenant is the DB-validated one set by TenantInterceptor.
    // Client-supplied headers are never used for namespacing. Anonymous requests are not cached.
    const userId: string | undefined = req.medicalUser?.id;
    const tenantId: string | undefined = TenantContext.getTenantId();
    if (!userId || !tenantId) return next.handle();

    const compositeKey = `${tenantId}:${userId}:${clientKey}`;
    const bodyHash = createHash('sha256').update(JSON.stringify(req.body ?? null)).digest('hex');
    const fingerprint = `${req.method}:${req.path}:${bodyHash}`;

    // No pooled connection is held while the handler runs: the claim is a short
    // transaction, and the handler gets its own connections from the pool.
    const deadline = Date.now() + LOCK_TIMEOUT_MS;
    let existing = await this.claim(compositeKey, fingerprint);

    while (existing?.statusCode === IN_PROGRESS) {
      if (Date.now() >= deadline) {
        throw new ConflictException(
          `A request with Idempotency-Key '${clientKey}' is already in progress`,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, LOCK_RETRY_INTERVAL_MS));
      existing = await this.claim(compositeKey, fingerprint);
    }

    if (existing) {
      if (existing.requestFingerprint !== fingerprint) {
        throw new UnprocessableEntityException(
          `Idempotency-Key '${clientKey}' was already used for ${existing.requestFingerprint}`,
        );
      }

      this.logger.debug(`[Idempotency] Replaying cached response for key=${clientKey}`);

      for (const [name, value] of Object.entries(existing.headers)) {
        res.setHeader(name, value);
      }
      res.setHeader('Idempotent-Replayed', 'true');
      res.status(existing.statusCode);

      return of(existing.body);
    }

    let body: any;
    try {
      body = await firstValueFrom(next.handle());
    } catch (err) {
      await this.releaseClaim(compositeKey, clientKey);
      throw err;
    }

    const statusCode: number = res.statusCode ?? 200;
    const location = res.getHeader('location');
    const headers: Record<string, string> = location ? { location: String(location) } : {};

    try {
      await this.repo.upsert(
        {
          key: compositeKey,
          statusCode,
          body: body ?? {},
          headers,
          requestFingerprint: fingerprint,
        },
        ['key'],
      );
    } catch (err) {
      // Non-fatal — the response has already been produced; free the claim so a retry can run
      this.logger.error(
        `[Idempotency] Failed to persist key=${clientKey}: ${(err as Error).message}`,
      );
      await this.releaseClaim(compositeKey, clientKey);
    }

    return of(body);
  }

  /**
   * Runs in one short transaction. The transaction-scoped advisory lock serialises
   * claimers for the same key. Returns the live row if one exists (in progress or
   * completed), or null after inserting an in-progress row that this request now owns.
   */
  private async claim(
    compositeKey: string,
    fingerprint: string,
  ): Promise<HttpIdempotencyEntity | null> {
    const runner: QueryRunner = this.dataSource.createQueryRunner();
    await runner.connect();

    try {
      await runner.startTransaction();
      await runner.query('SELECT pg_advisory_xact_lock(hashtext($1))', [compositeKey]);

      let existing = await runner.manager.findOne(HttpIdempotencyEntity, {
        where: { key: compositeKey },
      });

      if (existing) {
        const ttl = existing.statusCode === IN_PROGRESS ? IN_PROGRESS_TTL_MS : TTL_MS;
        if (existing.createdAt < new Date(Date.now() - ttl)) {
          await runner.manager.delete(HttpIdempotencyEntity, { key: compositeKey });
          existing = null;
        }
      }

      if (!existing) {
        await runner.manager.insert(HttpIdempotencyEntity, {
          key: compositeKey,
          statusCode: IN_PROGRESS,
          body: {},
          headers: {},
          requestFingerprint: fingerprint,
        });
      }

      await runner.commitTransaction();
      return existing;
    } catch (err) {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      throw err;
    } finally {
      await runner.release();
    }
  }

  private async releaseClaim(compositeKey: string, clientKey: string): Promise<void> {
    try {
      await this.repo.delete({ key: compositeKey, statusCode: IN_PROGRESS });
    } catch (err) {
      this.logger.error(
        `[Idempotency] Failed to release claim for key=${clientKey}: ${(err as Error).message}`,
      );
    }
  }
}
