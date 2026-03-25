import { Request, Response, NextFunction } from 'express';
import { nonceMiddleware } from './nonce.middleware';

describe('nonceMiddleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {};
    res = {
      locals: {},
    };
    next = jest.fn();
  });

  it('should generate a unique nonce for each request', () => {
    nonceMiddleware(req as Request, res as Response, next);
    const nonce1 = res.locals.nonce;

    expect(nonce1).toBeDefined();
    expect(typeof nonce1).toBe('string');
    expect(nonce1.length).toBeGreaterThan(0);
    expect(next).toHaveBeenCalled();

    const req2: Partial<Request> = {};
    const res2: Partial<Response> = { locals: {} };
    nonceMiddleware(req2 as Request, res2 as Response, next);
    const nonce2 = res2.locals.nonce;

    expect(nonce2).toBeDefined();
    expect(nonce2).not.toBe(nonce1);
  });

  it('should attach the nonce to both res.locals and req', () => {
    nonceMiddleware(req as Request, res as Response, next);

    expect(res.locals.nonce).toBeDefined();
    expect((req as any).nonce).toBeDefined();
    expect(res.locals.nonce).toBe((req as any).nonce);
  });

  it('should generate a base64 encoded nonce of 16 bytes (approx 24 chars)', () => {
    nonceMiddleware(req as Request, res as Response, next);
    const nonce = res.locals.nonce;

    // 16 bytes base64 encoded should be 22-24 characters long
    expect(nonce.length).toBeGreaterThanOrEqual(22);
    expect(nonce.length).toBeLessThanOrEqual(24);
    
    // Check if it's valid base64 (roughly)
    expect(nonce).toMatch(/^[A-Za-z0-9+/=]+$/);
  });
});
