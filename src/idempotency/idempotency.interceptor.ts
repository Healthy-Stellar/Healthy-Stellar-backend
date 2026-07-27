import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ConflictException,
  UnprocessableEntityException,
  Logger,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpIdempotencyEntity } from './idempotency.entity';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const IDEMPOTENCY_HEADER = 'idempotency-key';
/** Keys expire after 24 hours */
const TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);

  constructor(
    @InjectRepository(HttpIdempotencyEntity)
    private readonly repo: Repository<HttpIdempotencyEntity>,
  ) {}

  async intercept(ctx: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const req = ctx.switchToHttp().getRequest();
    const res = ctx.switchToHttp().getResponse();

    // Only apply to mutating HTTP methods
    if (!MUTATING_METHODS.has(req.method)) {
      return next.handle();
    }

    const clientKey = req.headers[IDEMPOTENCY_HEADER] as string | undefined;
    if (!clientKey) {
      return next.handle();
    }

    if (clientKey.length > 256) {
      throw new UnprocessableEntityException('Idempotency-Key must be 256 characters or fewer');
    }

    const tenantId: string = req.headers['x-tenant-id'] ?? 'global';
    const userId: string = (req as any).user?.id ?? 'anonymous';
    const compositeKey = `${tenantId}:${userId}:${clientKey}`;
    const fingerprint = `${req.method}:${req.path}`;

    // Look up existing record (within TTL)
    const cutoff = new Date(Date.now() - TTL_MS);
    const existing = await this.repo.findOne({
      where: { key: compositeKey },
    });

    if (existing) {
      // Expired — treat as new
      if (existing.createdAt < cutoff) {
        await this.repo.delete({ key: compositeKey });
      } else {
        // Fingerprint mismatch — different endpoint reusing the same key
        if (existing.requestFingerprint !== fingerprint) {
          throw new UnprocessableEntityException(
            `Idempotency-Key '${clientKey}' was already used for ${existing.requestFingerprint}`,
          );
        }

        this.logger.debug(`[Idempotency] Replaying cached response for key=${clientKey}`);

        // Replay stored headers
        for (const [name, value] of Object.entries(existing.headers)) {
          res.setHeader(name, value);
        }
        res.setHeader('Idempotent-Replayed', 'true');
        res.status(existing.statusCode);

        return of(existing.body);
      }
    }

    // Process the request and cache the response
    return next.handle().pipe(
      tap(async (body) => {
        const statusCode: number = res.statusCode ?? 200;

        // Capture a safe subset of response headers
        const headers: Record<string, string> = {};
        for (const name of ['content-type', 'location', 'x-resource-id']) {
          const val = res.getHeader(name);
          if (val) headers[name] = String(val);
        }

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
          // Non-fatal — log and continue; the response has already been sent
          this.logger.error(
            `[Idempotency] Failed to persist key=${clientKey}: ${(err as Error).message}`,
          );
        }
      }),
    );
  }
}
