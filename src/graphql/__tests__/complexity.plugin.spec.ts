import { buildSchema, parse } from 'graphql';
import {
  ComplexityPlugin,
  calculateQueryDepth,
  DEFAULT_COMPLEXITY_THRESHOLD,
  DEFAULT_MAX_QUERY_DEPTH,
  TENANT_CONFIG_KEY_MAX_COMPLEXITY,
  TENANT_CONFIG_KEY_MAX_DEPTH,
} from '../plugins/complexity.plugin';

/* ─── Test schema ─────────────────────────────────────────────────── */
/* A chain of nested types (a -> b -> ... -> h), each exposing a scalar
 * "leaf" field so complexity can be exercised at any depth without
 * relying on introspection meta-fields. */

const schema = buildSchema(`
  type Query { a: Level1 }
  type Level1 { leaf: String b: Level2 }
  type Level2 { leaf: String c: Level3 }
  type Level3 { leaf: String d: Level4 }
  type Level4 { leaf: String e: Level5 }
  type Level5 { leaf: String f: Level6 }
  type Level6 { leaf: String g: Level7 }
  type Level7 { leaf: String h: String }
`);

/* ─── Helpers / mocks ─────────────────────────────────────────────── */

function createConfigService(overrides: Record<string, string | undefined> = {}) {
  return { get: jest.fn((key: string) => overrides[key]) };
}

function createTenantConfigService() {
  return { get: jest.fn().mockResolvedValue(undefined) };
}

function createAuditLogService() {
  return { log: jest.fn().mockResolvedValue(undefined) };
}

function buildContext(opts: { userId?: string; tenantId?: string; headers?: Record<string, any> } = {}) {
  return {
    req: {
      user: opts.userId || opts.tenantId ? { userId: opts.userId, tenantId: opts.tenantId } : undefined,
      headers: opts.headers ?? {},
      ip: '203.0.113.5',
    },
  };
}

async function resolveOperation(
  plugin: ComplexityPlugin,
  opts: {
    query: string;
    operationName?: string;
    contextValue?: any;
  },
) {
  const listener: any = await plugin.requestDidStart();
  return listener.didResolveOperation({
    request: { operationName: opts.operationName, variables: {} },
    document: parse(opts.query),
    contextValue: opts.contextValue ?? buildContext(),
    schema,
  });
}

/* ═══════════════════════════════════════════════════════════════════ */
/*                      calculateQueryDepth                            */
/* ═══════════════════════════════════════════════════════════════════ */

describe('calculateQueryDepth', () => {
  it('computes the nesting depth of a query', () => {
    const document = parse('query Shallow { a { b { c { leaf } } } }');
    expect(calculateQueryDepth(document, 'Shallow')).toBe(4);
  });

  it('ignores introspection fields when computing depth', () => {
    const document = parse('query WithIntrospection { a { __typename } }');
    // "__typename" is skipped entirely, so it contributes nothing to depth.
    expect(calculateQueryDepth(document, 'WithIntrospection')).toBe(1);
  });

  it('resolves fragment spreads when computing depth', () => {
    const document = parse(`
      query WithFragment { a { ...OnLevel1 } }
      fragment OnLevel1 on Level1 { b { c { leaf } } }
    `);
    expect(calculateQueryDepth(document, 'WithFragment')).toBe(4);
  });

  it('returns 0 when the named operation cannot be found', () => {
    const document = parse('query Other { a { b { leaf } } }');
    expect(calculateQueryDepth(document, 'DoesNotExist')).toBe(0);
  });
});

/* ═══════════════════════════════════════════════════════════════════ */
/*                          ComplexityPlugin                           */
/* ═══════════════════════════════════════════════════════════════════ */

describe('ComplexityPlugin', () => {
  const schemaHost = { schema };

  it('allows a query within the default depth and complexity limits', async () => {
    const configService = createConfigService();
    const tenantConfigService = createTenantConfigService();
    const auditLogService = createAuditLogService();
    const plugin = new ComplexityPlugin(
      schemaHost as any,
      configService as any,
      tenantConfigService as any,
      auditLogService as any,
    );

    await expect(
      resolveOperation(plugin, { query: 'query Small { a { b { leaf } } }', operationName: 'Small' }),
    ).resolves.toBeUndefined();
    expect(auditLogService.log).not.toHaveBeenCalled();
  });

  it('rejects a query exceeding the environment-configured max depth with a GraphQLError', async () => {
    const configService = createConfigService();
    const tenantConfigService = createTenantConfigService();
    const auditLogService = createAuditLogService();
    const plugin = new ComplexityPlugin(
      schemaHost as any,
      configService as any,
      tenantConfigService as any,
      auditLogService as any,
    );

    const query = 'query OverDepth { a { b { c { d { e { f { g { h } } } } } } } }';

    await expect(
      resolveOperation(plugin, {
        query,
        operationName: 'OverDepth',
        contextValue: buildContext({ userId: 'user-1', tenantId: 'tenant-a' }),
      }),
    ).rejects.toMatchObject({
      message: expect.stringContaining('Query depth'),
      extensions: {
        code: 'GRAPHQL_QUERY_DEPTH_EXCEEDED',
        maxDepth: DEFAULT_MAX_QUERY_DEPTH,
      },
    });

    // Rejected queries must produce an audit trail identifying the tenant/client.
    expect(auditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'GraphQLQuery',
        action: 'QUERY_REJECTED',
        userId: 'user-1',
        metadata: expect.objectContaining({ tenantId: 'tenant-a' }),
      }),
    );
  });

  it('rejects a query exceeding a configured complexity threshold', async () => {
    const configService = createConfigService({ GRAPHQL_QUERY_COMPLEXITY_THRESHOLD: '2' });
    const tenantConfigService = createTenantConfigService();
    const auditLogService = createAuditLogService();
    const plugin = new ComplexityPlugin(
      schemaHost as any,
      configService as any,
      tenantConfigService as any,
      auditLogService as any,
    );

    // complexity = 1 (a) + 1 (b) + 1 (leaf) = 3 > threshold of 2
    const query = 'query OverComplexity { a { b { leaf } } }';

    await expect(
      resolveOperation(plugin, { query, operationName: 'OverComplexity' }),
    ).rejects.toMatchObject({
      extensions: { code: 'GRAPHQL_QUERY_COMPLEXITY_EXCEEDED', threshold: 2 },
    });
  });

  it('applies a per-tenant override that tightens the effective complexity threshold', async () => {
    const configService = createConfigService({ GRAPHQL_QUERY_COMPLEXITY_THRESHOLD: '1000' });
    const tenantConfigService = createTenantConfigService();
    tenantConfigService.get.mockImplementation((_tenantId: string, key: string) =>
      key === TENANT_CONFIG_KEY_MAX_COMPLEXITY ? Promise.resolve(2) : Promise.resolve(undefined),
    );
    const auditLogService = createAuditLogService();
    const plugin = new ComplexityPlugin(
      schemaHost as any,
      configService as any,
      tenantConfigService as any,
      auditLogService as any,
    );

    const query = 'query OverComplexity { a { b { leaf } } }'; // complexity = 3

    await expect(
      resolveOperation(plugin, {
        query,
        operationName: 'OverComplexity',
        contextValue: buildContext({ userId: 'user-1', tenantId: 'tenant-strict' }),
      }),
    ).rejects.toMatchObject({
      extensions: { code: 'GRAPHQL_QUERY_COMPLEXITY_EXCEEDED', threshold: 2 },
    });
    expect(tenantConfigService.get).toHaveBeenCalledWith(
      'tenant-strict',
      TENANT_CONFIG_KEY_MAX_COMPLEXITY,
    );
  });

  it('never allows a tenant override to loosen the limit beyond the environment ceiling', async () => {
    const configService = createConfigService({ GRAPHQL_QUERY_COMPLEXITY_THRESHOLD: '2' });
    const tenantConfigService = createTenantConfigService();
    // Tenant attempts to raise its own budget far above the environment ceiling.
    tenantConfigService.get.mockImplementation((_tenantId: string, key: string) =>
      key === TENANT_CONFIG_KEY_MAX_COMPLEXITY ? Promise.resolve(100000) : Promise.resolve(undefined),
    );
    const auditLogService = createAuditLogService();
    const plugin = new ComplexityPlugin(
      schemaHost as any,
      configService as any,
      tenantConfigService as any,
      auditLogService as any,
    );

    const query = 'query OverComplexity { a { b { leaf } } }'; // complexity = 3 > env ceiling of 2

    await expect(
      resolveOperation(plugin, {
        query,
        operationName: 'OverComplexity',
        contextValue: buildContext({ userId: 'user-1', tenantId: 'tenant-loose' }),
      }),
    ).rejects.toMatchObject({
      extensions: { code: 'GRAPHQL_QUERY_COMPLEXITY_EXCEEDED', threshold: 2 },
    });
  });

  it('applies a per-tenant override that tightens the effective max depth', async () => {
    const configService = createConfigService();
    const tenantConfigService = createTenantConfigService();
    tenantConfigService.get.mockImplementation((_tenantId: string, key: string) =>
      key === TENANT_CONFIG_KEY_MAX_DEPTH ? Promise.resolve(2) : Promise.resolve(undefined),
    );
    const auditLogService = createAuditLogService();
    const plugin = new ComplexityPlugin(
      schemaHost as any,
      configService as any,
      tenantConfigService as any,
      auditLogService as any,
    );

    // depth = 3 (a -> b -> leaf), fine under the env default of 7, but over
    // this tenant's override of 2.
    const query = 'query Small { a { b { leaf } } }';

    await expect(
      resolveOperation(plugin, {
        query,
        operationName: 'Small',
        contextValue: buildContext({ userId: 'user-1', tenantId: 'tenant-strict-depth' }),
      }),
    ).rejects.toMatchObject({
      extensions: { code: 'GRAPHQL_QUERY_DEPTH_EXCEEDED', maxDepth: 2 },
    });
  });

  it('falls back to environment defaults if the tenant-config lookup fails', async () => {
    const configService = createConfigService();
    const tenantConfigService = createTenantConfigService();
    tenantConfigService.get.mockRejectedValue(new Error('redis unavailable'));
    const auditLogService = createAuditLogService();
    const plugin = new ComplexityPlugin(
      schemaHost as any,
      configService as any,
      tenantConfigService as any,
      auditLogService as any,
    );

    await expect(
      resolveOperation(plugin, {
        query: 'query Small { a { b { leaf } } }',
        operationName: 'Small',
        contextValue: buildContext({ userId: 'user-1', tenantId: 'tenant-flaky' }),
      }),
    ).resolves.toBeUndefined();
  });

  it('does not skip the rejection if writing the audit log entry fails', async () => {
    const configService = createConfigService({ GRAPHQL_QUERY_COMPLEXITY_THRESHOLD: '2' });
    const tenantConfigService = createTenantConfigService();
    const auditLogService = createAuditLogService();
    auditLogService.log.mockRejectedValue(new Error('db unavailable'));
    const plugin = new ComplexityPlugin(
      schemaHost as any,
      configService as any,
      tenantConfigService as any,
      auditLogService as any,
    );

    await expect(
      resolveOperation(plugin, {
        query: 'query OverComplexity { a { b { leaf } } }',
        operationName: 'OverComplexity',
      }),
    ).rejects.toMatchObject({ extensions: { code: 'GRAPHQL_QUERY_COMPLEXITY_EXCEEDED' } });
  });

  it('does not consult tenant config for anonymous/global requests', async () => {
    const configService = createConfigService();
    const tenantConfigService = createTenantConfigService();
    const auditLogService = createAuditLogService();
    const plugin = new ComplexityPlugin(
      schemaHost as any,
      configService as any,
      tenantConfigService as any,
      auditLogService as any,
    );

    await resolveOperation(plugin, {
      query: 'query Small { a { b { leaf } } }',
      operationName: 'Small',
      contextValue: buildContext(),
    });

    expect(tenantConfigService.get).not.toHaveBeenCalled();
  });

  it('uses DEFAULT_COMPLEXITY_THRESHOLD / DEFAULT_MAX_QUERY_DEPTH when nothing is configured', async () => {
    const configService = createConfigService();
    const tenantConfigService = createTenantConfigService();
    const auditLogService = createAuditLogService();
    const plugin = new ComplexityPlugin(
      schemaHost as any,
      configService as any,
      tenantConfigService as any,
      auditLogService as any,
    );

    const query = 'query OverDepth { a { b { c { d { e { f { g { h } } } } } } } }';

    await expect(
      resolveOperation(plugin, { query, operationName: 'OverDepth' }),
    ).rejects.toMatchObject({
      extensions: { code: 'GRAPHQL_QUERY_DEPTH_EXCEEDED', maxDepth: DEFAULT_MAX_QUERY_DEPTH },
    });
    expect(DEFAULT_COMPLEXITY_THRESHOLD).toBeGreaterThan(0);
  });
});
