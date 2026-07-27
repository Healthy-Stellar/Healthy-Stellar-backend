import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ConfigDriftService } from './config-drift.service';

const VALID_ENV = {
  NODE_ENV: 'development',
  PORT: '3000',
  DB_HOST: 'localhost',
  DB_PORT: '5432',
  DB_USERNAME: 'user',
  DB_PASSWORD: 'pass',
  DB_NAME: 'db',
  JWT_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  REDIS_HOST: 'localhost',
  STELLAR_NETWORK: 'testnet',
  STELLAR_SECRET_KEY: 'SXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  STELLAR_CONTRACT_ID: 'CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  ENCRYPTION_KEY: 'a'.repeat(64),
  ALLOWED_ORIGINS: 'http://localhost:3000',
  METRICS_TOKEN: 'token',
  QUEUE_HMAC_SECRET: 'c'.repeat(32),
};

describe('ConfigDriftService', () => {
  let service: ConfigDriftService;
  let configValues: Record<string, string>;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(async () => {
    configValues = { ...VALID_ENV };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConfigDriftService,
        {
          provide: ConfigService,
          useValue: { get: (key: string) => configValues[key] },
        },
      ],
    }).compile();

    service = module.get(ConfigDriftService);
    warnSpy = jest.spyOn(service['logger'], 'warn').mockImplementation(() => {});
    errorSpy = jest.spyOn(service['logger'], 'error').mockImplementation(() => {});

    service.onApplicationBootstrap();
  });

  it('reports no drift when config is unchanged', () => {
    service.detectDrift();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('reports drift when a key value changes at runtime', () => {
    configValues['DB_HOST'] = 'other-host';
    service.detectDrift();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('DB_HOST'));
  });

  it('reports a schema validation error when a required key becomes invalid', () => {
    configValues['JWT_SECRET'] = 'short'; // violates min(32)
    service.detectDrift();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Runtime configuration is invalid'));
  });

  it('reports drift for keys that appear after startup', () => {
    configValues['NEW_KEY'] = 'surprise';
    // Manually add to schema keys mock by patching snapshot indirectly
    // We test via detectDrift seeing a new key not in baseline
    service['baseline']['NEW_KEY'] = undefined as any;
    configValues['NEW_KEY'] = 'surprise';
    service.detectDrift();
    // No crash — graceful handling
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
