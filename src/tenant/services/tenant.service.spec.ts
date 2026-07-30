import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, getDataSourceToken } from '@nestjs/typeorm';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { Tenant } from '../entities/tenant.entity';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a DataSource mock with controllable query responses. */
function makeDataSource(overrides: Partial<{ query: jest.Mock }> = {}) {
  return {
    query: jest.fn().mockResolvedValue([{ acquired: true }]),
    ...overrides,
  };
}

function makeTenantRepo(overrides: Partial<Record<string, jest.Mock>> = {}) {
  return {
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation((dto) => dto),
    save: jest.fn().mockImplementation((t) => Promise.resolve({ id: 'uuid-1', ...t })),
    find: jest.fn().mockResolvedValue([]),
    remove: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

async function buildModule(ds: any, repo: any) {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      TenantService,
      { provide: getRepositoryToken(Tenant), useValue: repo },
      { provide: getDataSourceToken(), useValue: ds },
    ],
  }).compile();
  return module.get(TenantService);
}

// ─── Slug allowlist validation ────────────────────────────────────────────────

describe('TenantService — slug allowlist (assertSafeSlug)', () => {
  let service: TenantService;
  let ds: ReturnType<typeof makeDataSource>;

  beforeEach(async () => {
    ds = makeDataSource();
    service = await buildModule(ds, makeTenantRepo());
  });

  const valid = ['abc', 'abc123', 'a_b_c', 'a'.repeat(63), 'tenant_01'];
  const invalid = [
    'ab',                          // too short
    'a'.repeat(64),                // too long
    'ABC',                         // uppercase
    'abc-def',                     // hyphen
    'abc def',                     // space
    'abc"def',                     // double-quote (injection vector)
    'abc"; DROP SCHEMA public --', // full injection payload
    '',                            // empty
    'abc!',                        // special char
  ];

  it.each(valid)('accepts valid slug "%s"', async (slug) => {
    await expect(service.provisionTenantSchema(slug)).resolves.not.toThrow();
  });

  it.each(invalid)('rejects invalid slug "%s"', async (slug) => {
    await expect(service.provisionTenantSchema(slug)).rejects.toThrow(BadRequestException);
    // Must never reach the database
    expect(ds.query).not.toHaveBeenCalled();
  });

  it('rejects injection payload in create()', async () => {
    await expect(
      service.create({ name: 'Evil Corp', slug: 'abc" CASCADE; DROP SCHEMA public --' }),
    ).rejects.toThrow(BadRequestException);
    expect(ds.query).not.toHaveBeenCalled();
  });
});

// ─── Advisory lock ────────────────────────────────────────────────────────────

describe('TenantService — advisory lock', () => {
  it('acquires pg_try_advisory_lock keyed on the schema name', async () => {
    const ds = makeDataSource();
    // After the lock query, subsequent queries succeed (migrations + seed)
    ds.query.mockResolvedValue([{ acquired: true }]);
    const service = await buildModule(ds, makeTenantRepo());

    await service.provisionTenantSchema('myslug');

    expect(ds.query).toHaveBeenCalledWith(
      expect.stringContaining('pg_try_advisory_lock'),
      ['tenant_myslug'],
    );
  });

  it('throws ConflictException when lock is already held', async () => {
    const ds = makeDataSource({
      query: jest.fn().mockResolvedValue([{ acquired: false }]),
    });
    const service = await buildModule(ds, makeTenantRepo());

    await expect(service.provisionTenantSchema('myslug')).rejects.toThrow(ConflictException);
  });

  it('releases the advisory lock in the finally block on success', async () => {
    const ds = makeDataSource();
    ds.query.mockResolvedValue([{ acquired: true }]);
    const service = await buildModule(ds, makeTenantRepo());

    await service.provisionTenantSchema('myslug');

    const unlockCall = ds.query.mock.calls.find(
      ([sql]: [string]) => sql.includes('pg_advisory_unlock'),
    );
    expect(unlockCall).toBeDefined();
    expect(unlockCall[1]).toEqual(['tenant_myslug']);
  });

  it('releases the advisory lock in the finally block on failure', async () => {
    let callCount = 0;
    const ds = makeDataSource({
      query: jest.fn().mockImplementation((sql: string) => {
        callCount++;
        if (callCount === 1) return Promise.resolve([{ acquired: true }]); // lock acquired
        if (sql.includes('CREATE SCHEMA')) return Promise.resolve();
        if (sql.includes('CREATE TABLE') || sql.includes('CREATE INDEX')) {
          throw new Error('migration failure');
        }
        return Promise.resolve();
      }),
    });
    const service = await buildModule(ds, makeTenantRepo());

    await expect(service.provisionTenantSchema('myslug')).rejects.toThrow('migration failure');

    const unlockCall = ds.query.mock.calls.find(
      ([sql]: [string]) => sql.includes('pg_advisory_unlock'),
    );
    expect(unlockCall).toBeDefined();
  });
});

// ─── Compensating saga ────────────────────────────────────────────────────────

describe('TenantService — compensating saga', () => {
  it('drops the schema when runTenantMigrations throws', async () => {
    let callCount = 0;
    const ds = makeDataSource({
      query: jest.fn().mockImplementation((sql: string) => {
        callCount++;
        if (callCount === 1) return Promise.resolve([{ acquired: true }]); // advisory lock
        if (sql.includes('CREATE SCHEMA')) return Promise.resolve();
        if (sql.includes('CREATE TABLE')) throw new Error('migration error');
        return Promise.resolve(); // DROP SCHEMA + advisory unlock
      }),
    });
    const service = await buildModule(ds, makeTenantRepo());

    await expect(service.provisionTenantSchema('myslug')).rejects.toThrow('migration error');

    const dropCall = ds.query.mock.calls.find(
      ([sql]: [string]) => sql.includes('DROP SCHEMA IF EXISTS'),
    );
    expect(dropCall).toBeDefined();
    expect(dropCall[0]).toContain('"tenant_myslug"');
  });

  it('drops the schema when seedTenantData throws', async () => {
    let callCount = 0;
    const ds = makeDataSource({
      query: jest.fn().mockImplementation((sql: string) => {
        callCount++;
        if (callCount === 1) return Promise.resolve([{ acquired: true }]);
        if (sql.includes('CREATE SCHEMA')) return Promise.resolve();
        if (sql.includes('INSERT INTO')) throw new Error('seed error');
        return Promise.resolve();
      }),
    });
    const service = await buildModule(ds, makeTenantRepo());

    await expect(service.provisionTenantSchema('myslug')).rejects.toThrow('seed error');

    const dropCall = ds.query.mock.calls.find(
      ([sql]: [string]) => sql.includes('DROP SCHEMA IF EXISTS'),
    );
    expect(dropCall).toBeDefined();
  });

  it('does NOT drop the schema when CREATE SCHEMA itself fails (nothing to roll back)', async () => {
    let callCount = 0;
    const ds = makeDataSource({
      query: jest.fn().mockImplementation((sql: string) => {
        callCount++;
        if (callCount === 1) return Promise.resolve([{ acquired: true }]);
        if (sql.includes('CREATE SCHEMA')) throw new Error('schema creation failed');
        return Promise.resolve();
      }),
    });
    const service = await buildModule(ds, makeTenantRepo());

    await expect(service.provisionTenantSchema('myslug')).rejects.toThrow('schema creation failed');

    const dropCall = ds.query.mock.calls.find(
      ([sql]: [string]) => sql.includes('DROP SCHEMA IF EXISTS') && !sql.includes('advisory'),
    );
    expect(dropCall).toBeUndefined();
  });

  it('re-throws the original error even if the compensating DROP also fails', async () => {
    let callCount = 0;
    const ds = makeDataSource({
      query: jest.fn().mockImplementation((sql: string) => {
        callCount++;
        if (callCount === 1) return Promise.resolve([{ acquired: true }]);
        if (sql.includes('CREATE SCHEMA')) return Promise.resolve();
        if (sql.includes('CREATE TABLE')) throw new Error('original error');
        if (sql.includes('DROP SCHEMA')) throw new Error('drop also failed');
        return Promise.resolve();
      }),
    });
    const service = await buildModule(ds, makeTenantRepo());

    await expect(service.provisionTenantSchema('myslug')).rejects.toThrow('original error');
  });
});

// ─── create() integration ─────────────────────────────────────────────────────

describe('TenantService — create()', () => {
  it('throws ConflictException when slug already exists', async () => {
    const repo = makeTenantRepo({
      findOne: jest.fn().mockResolvedValue({ id: 'existing', slug: 'myslug' }),
    });
    const service = await buildModule(makeDataSource(), repo);

    await expect(service.create({ name: 'Dup', slug: 'myslug' })).rejects.toThrow(
      ConflictException,
    );
  });

  it('saves tenant record and provisions schema on success', async () => {
    const ds = makeDataSource();
    ds.query.mockResolvedValue([{ acquired: true }]);
    const repo = makeTenantRepo();
    const service = await buildModule(ds, repo);

    const result = await service.create({ name: 'Good Tenant', slug: 'good_slug' });

    expect(repo.save).toHaveBeenCalled();
    expect(result.slug).toBe('good_slug');
    // Advisory lock must have been acquired
    expect(ds.query).toHaveBeenCalledWith(
      expect.stringContaining('pg_try_advisory_lock'),
      ['tenant_good_slug'],
    );
  });
});
