import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { HttpMetricsInterceptor } from './http-metrics.interceptor';
import { CustomMetricsService } from '../custom-metrics.service';

function buildContext(method = 'GET', routePath = '/test', statusCode = 200): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ method, route: { path: routePath }, url: routePath }),
      getResponse: () => ({ statusCode }),
    }),
  } as unknown as ExecutionContext;
}

function buildHandler(value: any = {}): CallHandler {
  return { handle: () => of(value) };
}

describe('HttpMetricsInterceptor', () => {
  let interceptor: HttpMetricsInterceptor;
  let metrics: jest.Mocked<Pick<CustomMetricsService, 'recordHttpRequest'>>;

  beforeEach(() => {
    metrics = { recordHttpRequest: jest.fn() };
    interceptor = new HttpMetricsInterceptor(metrics as any);
  });

  it('records a successful request', (done) => {
    const ctx = buildContext('GET', '/patients', 200);
    interceptor.intercept(ctx, buildHandler()).subscribe({
      complete: () => {
        expect(metrics.recordHttpRequest).toHaveBeenCalledWith(
          'GET',
          '/patients',
          200,
          expect.any(Number),
        );
        done();
      },
    });
  });

  it('records a failed request with error status', (done) => {
    const ctx = buildContext('POST', '/records', 500);
    const handler: CallHandler = { handle: () => throwError(() => ({ status: 422 })) };

    interceptor.intercept(ctx, handler).subscribe({
      error: () => {
        expect(metrics.recordHttpRequest).toHaveBeenCalledWith(
          'POST',
          '/records',
          422,
          expect.any(Number),
        );
        done();
      },
    });
  });

  it('falls back to 500 when error has no status', (done) => {
    const ctx = buildContext('DELETE', '/resource', 500);
    const handler: CallHandler = { handle: () => throwError(() => new Error('boom')) };

    interceptor.intercept(ctx, handler).subscribe({
      error: () => {
        expect(metrics.recordHttpRequest).toHaveBeenCalledWith(
          'DELETE',
          '/resource',
          500,
          expect.any(Number),
        );
        done();
      },
    });
  });

  it('uses req.url when route.path is unavailable', (done) => {
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({ method: 'GET', url: '/fallback-url' }),
        getResponse: () => ({ statusCode: 200 }),
      }),
    } as unknown as ExecutionContext;

    interceptor.intercept(ctx, buildHandler()).subscribe({
      complete: () => {
        expect(metrics.recordHttpRequest).toHaveBeenCalledWith(
          'GET',
          '/fallback-url',
          200,
          expect.any(Number),
        );
        done();
      },
    });
  });
});
