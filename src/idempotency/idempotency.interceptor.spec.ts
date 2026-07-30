import { ExecutionContext } from '@nestjs/common';
import { of, firstValueFrom } from 'rxjs';
import { IdempotencyInterceptor } from './idempotency.interceptor';

describe('IdempotencyInterceptor', () => {
  let interceptor: IdempotencyInterceptor;
  let dataSource: { query: jest.Mock };
  let req: any;
  let res: any;
  let ctx: ExecutionContext;

  beforeEach(() => {
    dataSource = {
      query: jest.fn(),
    };

    interceptor = new IdempotencyInterceptor(dataSource as any);

    req = {
      method: 'POST',
      path: '/appointments',
      headers: {
        'idempotency-key': 'same-key',
        'x-tenant-id': 'tenant-1',
      },
      user: { id: 'user-1' },
    };

    res = {
      statusCode: 201,
      getHeader: jest.fn(),
      setHeader: jest.fn(),
    };

    ctx = {
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => res,
      }),
    } as unknown as ExecutionContext;
  });

  it('uses a per-key advisory lock while checking and persisting the idempotency result', async () => {
    // Query call order:
    // 1. DELETE expired
    // 2. INSERT sentinel (winner → rowCount 1)
    // 3. pg_advisory_lock
    // 4. recheck SELECT → no existing result
    // 5. UPDATE (inside tap)
    // 6. pg_advisory_unlock
    dataSource.query
      .mockResolvedValueOnce([]) // DELETE
      .mockResolvedValueOnce([{ rowCount: 1 }]) // INSERT sentinel — winner
      .mockResolvedValueOnce(undefined) // pg_advisory_lock
      .mockResolvedValueOnce([]) // recheck SELECT — no existing result
      .mockResolvedValueOnce(undefined) // UPDATE
      .mockResolvedValueOnce(undefined); // pg_advisory_unlock

    const result = await firstValueFrom(
      await interceptor.intercept(ctx, { handle: () => of({ ok: true }) } as any),
    );

    expect(result).toEqual({ ok: true });
    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('pg_advisory_lock'),
      [expect.any(Number)],
    );
    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('pg_advisory_unlock'),
      [expect.any(Number)],
    );
    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE http_idempotency_keys'),
      expect.any(Array),
    );
  });

  it('replays cached response when a prior result exists under the advisory lock', async () => {
    const cachedRow = {
      key: 'tenant-1:user-1:same-key',
      statusCode: 201,
      body: { ok: true },
      headers: { 'content-type': 'application/json' },
      requestFingerprint: 'POST:/appointments',
    };

    dataSource.query
      .mockResolvedValueOnce([]) // DELETE
      .mockResolvedValueOnce([{ rowCount: 1 }]) // INSERT sentinel — winner
      .mockResolvedValueOnce(undefined) // pg_advisory_lock
      .mockResolvedValueOnce([cachedRow]) // recheck SELECT — existing result
      .mockResolvedValueOnce(undefined); // pg_advisory_unlock

    const result = await firstValueFrom(
      await interceptor.intercept(ctx, { handle: () => of({ ok: true }) } as any),
    );

    expect(result).toEqual({ ok: true });
    expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
    expect(res.setHeader).toHaveBeenCalledWith('Idempotent-Replayed', 'true');
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('throws when fingerprint mismatches an existing cached result', async () => {
    const cachedRow = {
      key: 'tenant-1:user-1:same-key',
      statusCode: 201,
      body: { ok: true },
      headers: {},
      requestFingerprint: 'POST:/patients',
    };

    dataSource.query
      .mockResolvedValueOnce([]) // DELETE
      .mockResolvedValueOnce([{ rowCount: 1 }]) // INSERT sentinel — winner
      .mockResolvedValueOnce(undefined) // pg_advisory_lock
      .mockResolvedValueOnce([cachedRow]) // recheck SELECT — existing result
      .mockResolvedValueOnce(undefined); // pg_advisory_unlock

    await expect(
      firstValueFrom(
        await interceptor.intercept(ctx, { handle: () => of({ ok: true }) } as any),
      ),
    ).rejects.toThrow();
  });
});
