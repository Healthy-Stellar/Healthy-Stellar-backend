import { GraphQLError } from 'graphql';
import { ApqPlugin } from '../plugins/apq.plugin';
import { ApqService } from '../services/apq.service';

/* ─── Helpers ────────────────────────────────────────────────────── */

function buildRequestContext(opts: {
  extensions?: Record<string, any>;
  query?: string;
  operationName?: string;
}): any {
  return {
    request: {
      extensions: opts.extensions,
      query: opts.query,
      operationName: opts.operationName,
      parsedQuery: opts.query
        ? { loc: { source: { body: opts.query } } }
        : undefined,
    },
  };
}

/* ─── Mock ApqService ────────────────────────────────────────────── */

const createMockApqService = () => ({
  getQuery: jest.fn(),
  storeQuery: jest.fn(),
});

/* ═══════════════════════════════════════════════════════════════════ */
/*                         ApqPlugin tests                            */
/* ═══════════════════════════════════════════════════════════════════ */

describe('ApqPlugin', () => {
  let plugin: ApqPlugin;
  let mockApqService: ReturnType<typeof createMockApqService>;
  let listener: Record<string, (...args: any[]) => Promise<any>>;

  beforeEach(async () => {
    mockApqService = createMockApqService();
    plugin = new ApqPlugin(mockApqService as any);
    jest.clearAllMocks();
  });

  const startListener = async (opts?: {
    extensions?: Record<string, any>;
    query?: string;
  }): Promise<void> => {
    const requestListener = await plugin.requestDidStart();
    listener = requestListener as Record<string, (...args: any[]) => Promise<any>>;
    if (opts) {
      await listener.didResolveOperation(buildRequestContext(opts));
    }
  };

  /* ── no persistedQuery extension in dev mode ─────────────────── */

  describe('development mode (NODE_ENV !== production)', () => {
    const originalNodeEnv = process.env.NODE_ENV;

    beforeAll(() => {
      process.env.NODE_ENV = 'development';
    });

    afterAll(() => {
      process.env.NODE_ENV = originalNodeEnv;
    });

    it('allows arbitrary queries without persistedQuery extension', async () => {
      await startListener({ query: 'query Me { me { id } }' });
      expect(mockApqService.getQuery).not.toHaveBeenCalled();
      expect(listener).toBeDefined();
    });
  });

  /* ── no persistedQuery extension in production ──────────────── */

  describe('production mode (NODE_ENV === production)', () => {
    const originalNodeEnv = process.env.NODE_ENV;

    beforeAll(() => {
      process.env.NODE_ENV = 'production';
    });

    afterAll(() => {
      process.env.NODE_ENV = originalNodeEnv;
    });

    it('rejects requests missing persistedQuery extension', async () => {
      await expect(
        startListener({ query: 'query Me { me { id } }' }),
      ).rejects.toMatchObject({
        message: expect.stringContaining('Persisted queries are required'),
        extensions: { code: 'PERSISTED_QUERY_REQUIRED' },
      });
    });

    it('rejects requests with empty sha256Hash', async () => {
      await expect(
        startListener({ extensions: { persistedQuery: {} } }),
      ).rejects.toMatchObject({
        message: expect.stringContaining('Persisted queries are required'),
        extensions: { code: 'PERSISTED_QUERY_REQUIRED' },
      });
    });
  });

  /* ── unknown hash in production ──────────────────────────────── */

  describe('unknown hash in production', () => {
    const originalNodeEnv = process.env.NODE_ENV;

    beforeAll(() => {
      process.env.NODE_ENV = 'production';
    });

    afterAll(() => {
      process.env.NODE_ENV = originalNodeEnv;
    });

    it('rejects unknown query hash', async () => {
      mockApqService.getQuery.mockResolvedValueOnce(null);
      await expect(
        startListener({
          extensions: { persistedQuery: { sha256Hash: 'unknown-hash' } },
        }),
      ).rejects.toMatchObject({
        message: expect.stringContaining('Unknown persisted query hash'),
        extensions: { code: 'PERSISTED_QUERY_NOT_FOUND' },
      });
      expect(mockApqService.getQuery).toHaveBeenCalledWith('unknown-hash');
    });
  });

  /* ── known hash in production ────────────────────────────────── */

  describe('known hash in production', () => {
    const originalNodeEnv = process.env.NODE_ENV;

    beforeAll(() => {
      process.env.NODE_ENV = 'production';
    });

    afterAll(() => {
      process.env.NODE_ENV = originalNodeEnv;
    });

    it('allows request with known hash and replaces query with stored version', async () => {
      const knownQuery = 'query Me { me { id email } }';
      mockApqService.getQuery.mockResolvedValueOnce(knownQuery);
      await startListener({
        query: knownQuery,
        extensions: { persistedQuery: { sha256Hash: 'known-hash' } },
      });
      expect(mockApqService.getQuery).toHaveBeenCalledWith('known-hash');
    });

    it('rejects if query text does not match stored query', async () => {
      mockApqService.getQuery.mockResolvedValueOnce('query Me { me { id } }');
      await expect(
        startListener({
          query: 'query Me { me { id email } }',
          extensions: { persistedQuery: { sha256Hash: 'known-hash' } },
        }),
      ).rejects.toMatchObject({
        message: expect.stringContaining('Persisted query hash mismatch'),
        extensions: { code: 'PERSISTED_QUERY_MISMATCH' },
      });
    });
  });

  /* ── dev mode auto-registers unknown queries ────────────────── */

  describe('development mode auto-registration', () => {
    const originalNodeEnv = process.env.NODE_ENV;

    beforeAll(() => {
      process.env.NODE_ENV = 'development';
    });

    afterAll(() => {
      process.env.NODE_ENV = originalNodeEnv;
    });

    it('does not store unknown hashes', async () => {
      mockApqService.getQuery.mockResolvedValueOnce(null);
      await startListener({
        query: 'query Me { me { id } }',
        extensions: { persistedQuery: { sha256Hash: 'unknown-hash' } },
      });
      expect(mockApqService.storeQuery).not.toHaveBeenCalled();
    });
  });
});
