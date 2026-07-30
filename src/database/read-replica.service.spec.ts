import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { ReadReplicaService } from './read-replica.service';

describe('ReadReplicaService', () => {
  let primaryDataSource: any;
  let configService: { get: jest.Mock };

  beforeEach(() => {
    primaryDataSource = { query: jest.fn(), isInitialized: true };
  });

  async function buildService(env: Record<string, unknown>) {
    configService = { get: jest.fn((key: string, fallback?: unknown) => env[key] ?? fallback) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReadReplicaService,
        { provide: getDataSourceToken(), useValue: primaryDataSource },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    return module.get(ReadReplicaService);
  }

  it('falls back to the primary DataSource when no replica config is present', async () => {
    const service = await buildService({});
    await service.onModuleInit();

    expect(service.isUsingReplica()).toBe(false);
    expect(service.getDataSource()).toBe(primaryDataSource);
  });

  it('reports not-using-replica before initialization regardless of config', async () => {
    const service = await buildService({ DB_REPLICA_HOST: 'replica.internal' });
    // onModuleInit not called yet — should still safely fall back.
    expect(service.isUsingReplica()).toBe(false);
    expect(service.getDataSource()).toBe(primaryDataSource);
  });
});
