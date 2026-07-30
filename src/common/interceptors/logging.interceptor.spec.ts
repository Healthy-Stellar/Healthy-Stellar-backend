import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { LoggingInterceptor } from './logging.interceptor';
import { asyncLocalStorage } from '../middleware/request-context.middleware';

const makeLogger = () => ({
  setContext: jest.fn(),
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const makeCtx = (method = 'GET', url = '/test', headers: Record<string, string> = {}): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ method, url, headers }),
    }),
  } as any);

const makeHandler = (value: any = {}): CallHandler => ({
  handle: () => of(value),
});

const makeErrorHandler = (err: Error): CallHandler => ({
  handle: () => throwError(() => err),
});

describe('LoggingInterceptor', () => {
  let logger: ReturnType<typeof makeLogger>;
  let interceptor: LoggingInterceptor;

  beforeEach(() => {
    logger = makeLogger();
    interceptor = new LoggingInterceptor(logger as any);
  });

  it('logs requestId from AsyncLocalStorage context', (done) => {
    const store = { requestId: 'als-req-id', traceId: 't1', timestamp: '' };

    asyncLocalStorage.run(store, () => {
      interceptor.intercept(makeCtx(), makeHandler()).subscribe({
        complete: () => {
          expect(logger.log).toHaveBeenCalledWith(
            expect.objectContaining({ requestId: 'als-req-id' }),
          );
          done();
        },
      });
    });
  });

  it('falls back to x-request-id header when ALS has no store', (done) => {
    const ctx = makeCtx('GET', '/test', { 'x-request-id': 'header-req-id' });

    interceptor.intercept(ctx, makeHandler()).subscribe({
      complete: () => {
        expect(logger.log).toHaveBeenCalledWith(
          expect.objectContaining({ requestId: 'header-req-id' }),
        );
        done();
      },
    });
  });

  it('uses "unknown" when no requestId is available', (done) => {
    interceptor.intercept(makeCtx(), makeHandler()).subscribe({
      complete: () => {
        expect(logger.log).toHaveBeenCalledWith(
          expect.objectContaining({ requestId: 'unknown' }),
        );
        done();
      },
    });
  });

  it('logs method and url on every request', (done) => {
    interceptor.intercept(makeCtx('POST', '/records'), makeHandler()).subscribe({
      complete: () => {
        expect(logger.log).toHaveBeenCalledWith(
          expect.objectContaining({ method: 'POST', url: '/records' }),
        );
        done();
      },
    });
  });

  it('logs error with requestId on failure', (done) => {
    const store = { requestId: 'err-req-id', traceId: 't2', timestamp: '' };

    asyncLocalStorage.run(store, () => {
      interceptor
        .intercept(makeCtx(), makeErrorHandler(new Error('boom')))
        .subscribe({
          error: () => {
            expect(logger.error).toHaveBeenCalledWith(
              expect.objectContaining({
                requestId: 'err-req-id',
                error: 'boom',
              }),
            );
            done();
          },
        });
    });
  });

  it('warns on slow requests', (done) => {
    // Override threshold to 0ms so any request is "slow"
    (interceptor as any).slowRequestThreshold = 0;

    interceptor.intercept(makeCtx(), makeHandler()).subscribe({
      complete: () => {
        expect(logger.warn).toHaveBeenCalledWith(
          expect.objectContaining({ message: 'Slow request detected' }),
        );
        done();
      },
    });
  });
});
