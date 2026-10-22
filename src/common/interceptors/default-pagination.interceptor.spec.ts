import { of } from 'rxjs';
import { CallHandler, ExecutionContext } from '@nestjs/common';
import { DefaultPaginationInterceptor } from './default-pagination.interceptor';

/**
 * Unit tests for DefaultPaginationInterceptor.
 *
 * Core assertion (Issue #1 acceptance criterion):
 *   Omitting pagination params returns a pageSize of ≤ 20.
 */
describe('DefaultPaginationInterceptor', () => {
  let interceptor: DefaultPaginationInterceptor;

  const makeCtx = (method: string, query: Record<string, any>): ExecutionContext => {
    const request = { method, query };
    return {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
  };

  const handler: CallHandler = { handle: () => of(null) };

  beforeEach(() => {
    interceptor = new DefaultPaginationInterceptor();
  });

  // ── Default injection ────────────────────────────────────────────────────

  it('injects page=1 when page is absent', (done) => {
    const ctx = makeCtx('GET', {});
    interceptor.intercept(ctx, handler).subscribe(() => {
      expect(ctx.switchToHttp().getRequest().query.page).toBe('1');
      done();
    });
  });

  it('injects pageSize=20 when pageSize is absent', (done) => {
    const ctx = makeCtx('GET', {});
    interceptor.intercept(ctx, handler).subscribe(() => {
      expect(ctx.switchToHttp().getRequest().query.pageSize).toBe('20');
      done();
    });
  });

  it('injects limit=20 when limit is absent', (done) => {
    const ctx = makeCtx('GET', {});
    interceptor.intercept(ctx, handler).subscribe(() => {
      expect(ctx.switchToHttp().getRequest().query.limit).toBe('20');
      done();
    });
  });

  it('injects offset=0 when offset is absent', (done) => {
    const ctx = makeCtx('GET', {});
    interceptor.intercept(ctx, handler).subscribe(() => {
      expect(ctx.switchToHttp().getRequest().query.offset).toBe('0');
      done();
    });
  });

  // ── Acceptance criterion: omitting params returns ≤ 20 results cap ────────

  it('ensures omitting pagination params results in pageSize ≤ 20', (done) => {
    const ctx = makeCtx('GET', {});
    interceptor.intercept(ctx, handler).subscribe(() => {
      const pageSize = parseInt(ctx.switchToHttp().getRequest().query.pageSize, 10);
      expect(pageSize).toBeLessThanOrEqual(20);
      done();
    });
  });

  // ── Valid values preserved ───────────────────────────────────────────────

  it('preserves a valid page value supplied by the client', (done) => {
    const ctx = makeCtx('GET', { page: '3' });
    interceptor.intercept(ctx, handler).subscribe(() => {
      expect(ctx.switchToHttp().getRequest().query.page).toBe('3');
      done();
    });
  });

  it('preserves a valid pageSize value supplied by the client', (done) => {
    const ctx = makeCtx('GET', { pageSize: '50' });
    interceptor.intercept(ctx, handler).subscribe(() => {
      expect(ctx.switchToHttp().getRequest().query.pageSize).toBe('50');
      done();
    });
  });

  // ── Max cap enforcement ──────────────────────────────────────────────────

  it('caps pageSize at 100 when client sends 9999', (done) => {
    const ctx = makeCtx('GET', { pageSize: '9999' });
    interceptor.intercept(ctx, handler).subscribe(() => {
      expect(ctx.switchToHttp().getRequest().query.pageSize).toBe('100');
      done();
    });
  });

  it('caps limit at 100 when client sends 500', (done) => {
    const ctx = makeCtx('GET', { limit: '500' });
    interceptor.intercept(ctx, handler).subscribe(() => {
      expect(ctx.switchToHttp().getRequest().query.limit).toBe('100');
      done();
    });
  });

  // ── Invalid values reset to defaults ────────────────────────────────────

  it('resets page to 1 when client sends 0', (done) => {
    const ctx = makeCtx('GET', { page: '0' });
    interceptor.intercept(ctx, handler).subscribe(() => {
      expect(ctx.switchToHttp().getRequest().query.page).toBe('1');
      done();
    });
  });

  it('resets page to 1 when client sends a negative number', (done) => {
    const ctx = makeCtx('GET', { page: '-5' });
    interceptor.intercept(ctx, handler).subscribe(() => {
      expect(ctx.switchToHttp().getRequest().query.page).toBe('1');
      done();
    });
  });

  it('resets pageSize to 20 when client sends a non-numeric string', (done) => {
    const ctx = makeCtx('GET', { pageSize: 'all' });
    interceptor.intercept(ctx, handler).subscribe(() => {
      expect(ctx.switchToHttp().getRequest().query.pageSize).toBe('20');
      done();
    });
  });

  it('resets offset to 0 when client sends a negative number', (done) => {
    const ctx = makeCtx('GET', { offset: '-10' });
    interceptor.intercept(ctx, handler).subscribe(() => {
      expect(ctx.switchToHttp().getRequest().query.offset).toBe('0');
      done();
    });
  });

  // ── Non-GET requests are not touched ────────────────────────────────────

  it('does not inject pagination params on POST requests', (done) => {
    const ctx = makeCtx('POST', {});
    interceptor.intercept(ctx, handler).subscribe(() => {
      const q = ctx.switchToHttp().getRequest().query;
      expect(q.page).toBeUndefined();
      expect(q.pageSize).toBeUndefined();
      done();
    });
  });

  it('does not inject pagination params on DELETE requests', (done) => {
    const ctx = makeCtx('DELETE', {});
    interceptor.intercept(ctx, handler).subscribe(() => {
      expect(ctx.switchToHttp().getRequest().query.page).toBeUndefined();
      done();
    });
  });
});
