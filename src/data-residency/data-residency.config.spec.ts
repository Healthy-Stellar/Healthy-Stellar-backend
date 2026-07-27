import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { dataResidencyConfig, validateDataResidencyConfig } from '../config/data-residency.config';
import { DataResidencyService } from '../services/data-residency.service';

async function buildModule(env: Record<string, string>) {
  // Temporarily override process.env for this test
  const original = { ...process.env };
  Object.assign(process.env, env);

  try {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          ignoreEnvFile: true,
          validate: validateDataResidencyConfig,
          load: [dataResidencyConfig],
        }),
      ],
      providers: [DataResidencyService],
    }).compile();

    return module;
  } finally {
    // Restore env
    Object.keys(env).forEach((k) => {
      if (original[k] === undefined) delete process.env[k];
      else process.env[k] = original[k];
    });
  }
}

const FULL_ENV = {
  DB_HOST_EU: 'postgres-eu.test',
  DB_HOST_US: 'postgres-us.test',
  DB_HOST_APAC: 'postgres-apac.test',
  DB_HOST_AFRICA: 'postgres-africa.test',
};

describe('DataResidencyModule – config validation', () => {
  it('initialises successfully when all required DB_HOST_* vars are present', async () => {
    const module = await buildModule(FULL_ENV);
    const service = module.get(DataResidencyService);
    service.onModuleInit();
    expect(service.getDatabaseConfig('EU' as any).host).toBe('postgres-eu.test');
  });

  it('throws a startup error when DB_HOST_EU is missing', async () => {
    const { DB_HOST_EU: _omit, ...withoutEu } = FULL_ENV;
    await expect(buildModule(withoutEu)).rejects.toThrow(
      /DB_HOST_EU/,
    );
  });

  it('throws a startup error when DB_HOST_US is missing', async () => {
    const { DB_HOST_US: _omit, ...withoutUs } = FULL_ENV;
    await expect(buildModule(withoutUs)).rejects.toThrow(
      /DB_HOST_US/,
    );
  });
});
