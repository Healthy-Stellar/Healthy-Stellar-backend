import {
  RequestContextMiddleware,
  getRequestContext,
  setRequestContextUser,
} from './request-context.middleware';

describe('RequestContextMiddleware (#1324)', () => {
  const run = (headers: Record<string, string>, user?: any) =>
    new Promise<ReturnType<typeof getRequestContext>>((resolve) => {
      const req: any = { headers, user };
      const res: any = { setHeader: jest.fn() };
      new RequestContextMiddleware().use(req, res, () => resolve(getRequestContext()));
    });

  it('never takes userId from the client-supplied x-user-id header', async () => {
    const ctx = await run({ 'x-user-id': 'attacker-chosen' });
    expect(ctx?.userId).toBeUndefined();
    expect(ctx?.role).toBeUndefined();
  });

  it('does not read identity at middleware time (before guards run)', async () => {
    const ctx = await run({}, { userId: 'u1', role: 'patient' });
    expect(ctx?.userId).toBeUndefined();
  });

  it('setRequestContextUser populates identity on the active request context', async () => {
    await new Promise<void>((resolve) => {
      new RequestContextMiddleware().use(
        { headers: { 'x-user-id': 'spoofed' } } as any,
        { setHeader: jest.fn() } as any,
        () => {
          setRequestContextUser({ userId: 'verified-user', role: 'patient' });
          expect(getRequestContext()?.userId).toBe('verified-user');
          expect(getRequestContext()?.role).toBe('patient');
          resolve();
        },
      );
    });
  });

  it('setRequestContextUser is a no-op outside a request scope', () => {
    expect(() => setRequestContextUser({ userId: 'x', role: 'y' })).not.toThrow();
    expect(getRequestContext()).toBeUndefined();
  });
});
