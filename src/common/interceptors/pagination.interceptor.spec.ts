import { of } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { PaginationInterceptor } from './pagination.interceptor';

describe('PaginationInterceptor', () => {
  it('should inject default pagination values when none are provided', async () => {
    const interceptor = new PaginationInterceptor();
    const request = { query: {} };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
      getClass: () => null,
      getHandler: () => null,
    } as any;
    const next = { handle: jest.fn(() => of({ ok: true })) } as any;

    await firstValueFrom(interceptor.intercept(context, next));

    expect(request.query.page).toBe(1);
    expect(request.query.pageSize).toBe(20);
  });

  it('should map legacy limit to pageSize when provided', async () => {
    const interceptor = new PaginationInterceptor();
    const request = { query: { limit: '15' } };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
      getClass: () => null,
      getHandler: () => null,
    } as any;
    const next = { handle: jest.fn(() => of({ ok: true })) } as any;

    await firstValueFrom(interceptor.intercept(context, next));

    expect(request.query.page).toBe(1);
    expect(request.query.pageSize).toBe('15');
  });
});
