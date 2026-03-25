import { RequestIdMiddleware, REQUEST_ID_HEADER } from './request-id.middleware';
import { asyncLocalStorage } from './request-context.middleware';

const makeReq = (headers: Record<string, string> = {}): any => ({ headers });
const makeRes = (): any => {
  const headers: Record<string, string> = {};
  return {
    setHeader: jest.fn((k: string, v: string) => { headers[k.toLowerCase()] = v; }),
    _headers: headers,
  };
};

describe('RequestIdMiddleware', () => {
  let middleware: RequestIdMiddleware;

  beforeEach(() => {
    middleware = new RequestIdMiddleware();
  });

  it('generates a UUID v4 when X-Request-Id is absent', () => {
    const req = makeReq();
    const res = makeReq();
    res.setHeader = jest.fn();
    const next = jest.fn();

    middleware.use(req, res, next);

    const id = req.headers[REQUEST_ID_HEADER] as string;
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(next).toHaveBeenCalled();
  });

  it('forwards an existing X-Request-Id from the request', () => {
    const existingId = 'my-gateway-request-id';
    const req = makeReq({ [REQUEST_ID_HEADER]: existingId });
    const res = makeReq();
    res.setHeader = jest.fn();
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(req.headers[REQUEST_ID_HEADER]).toBe(existingId);
  });

  it('sets X-Request-Id on the response', () => {
    const req = makeReq();
    const res = makeRes();
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith(
      'X-Request-Id',
      req.headers[REQUEST_ID_HEADER],
    );
  });

  it('response header matches the request header value', () => {
    const existingId = 'correlation-abc-123';
    const req = makeReq({ [REQUEST_ID_HEADER]: existingId });
    const res = makeRes();
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', existingId);
  });

  it('calls next()', () => {
    const next = jest.fn();
    middleware.use(makeReq(), makeRes(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('patches AsyncLocalStorage store when it exists', () => {
    const store = {
      requestId: 'old-id',
      traceId: 'trace-1',
      timestamp: new Date().toISOString(),
    };

    asyncLocalStorage.run(store, () => {
      const existingId = 'new-gateway-id';
      const req = makeReq({ [REQUEST_ID_HEADER]: existingId });
      const res = makeRes();
      const next = jest.fn();

      middleware.use(req, res, next);

      expect(store.requestId).toBe(existingId);
    });
  });

  it('generates different IDs for consecutive requests', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 10; i++) {
      const req = makeReq();
      const res = makeRes();
      middleware.use(req, res, jest.fn());
      ids.add(req.headers[REQUEST_ID_HEADER] as string);
    }
    expect(ids.size).toBe(10);
  });

  it('trims whitespace from forwarded header', () => {
    const req = makeReq({ [REQUEST_ID_HEADER]: '  trimmed-id  ' });
    const res = makeRes();
    middleware.use(req, res, jest.fn());
    expect(req.headers[REQUEST_ID_HEADER]).toBe('trimmed-id');
  });
});
