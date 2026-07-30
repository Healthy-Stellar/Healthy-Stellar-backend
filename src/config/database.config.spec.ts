import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DatabaseConfig } from './database.config';

describe('DatabaseConfig', () => {
  let databaseConfig: DatabaseConfig;
  let configService: ConfigService;

  const baseConfig = {
    NODE_ENV: 'development',
    DB_HOST: 'localhost',
    DB_PORT: 5432,
    DB_USERNAME: 'test_user',
    DB_PASSWORD: 'test_password',
    DB_NAME: 'test_db',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DatabaseConfig,
        {
          provide: ConfigService,
          useValue: { get: jest.fn() },
        },
      ],
    }).compile();

    databaseConfig = module.get<DatabaseConfig>(DatabaseConfig);
    configService = module.get<ConfigService>(ConfigService);
  });

  function mockConfig(overrides: Record<string, any> = {}) {
    const config = { ...baseConfig, ...overrides };
    jest.spyOn(configService, 'get').mockImplementation((key: string, defaultValue?: any) => {
      return key in config ? config[key] : defaultValue;
    });
  }

  describe('createTypeOrmOptions', () => {
    it('should create TypeORM options with required configuration', () => {
      mockConfig();
      const options = databaseConfig.createTypeOrmOptions();

      expect(options.type).toBe('postgres');
      expect(options.host).toBe('localhost');
      expect(options.port).toBe(5432);
      expect(options.username).toBe('test_user');
      expect(options.password).toBe('test_password');
      expect(options.database).toBe('test_db');
      expect(options.synchronize).toBe(false);
      expect(options.migrationsRun).toBe(false);
    });

    it('should enforce synchronize: false in all environments', () => {
      mockConfig({ NODE_ENV: 'production' });
      expect(databaseConfig.createTypeOrmOptions().synchronize).toBe(false);
    });

    it('should use logging: [\'error\'] in production', () => {
      mockConfig({ NODE_ENV: 'production' });
      expect(databaseConfig.createTypeOrmOptions().logging).toEqual(['error']);
    });

    it('should use logging: [\'query\', \'error\'] in development', () => {
      mockConfig({ NODE_ENV: 'development' });
      expect(databaseConfig.createTypeOrmOptions().logging).toEqual(['query', 'error']);
    });

    it('should default pool to min: 2, max: 10', () => {
      mockConfig();
      const options = databaseConfig.createTypeOrmOptions();
      expect((options as any).extra.min).toBe(2);
      expect((options as any).extra.max).toBe(10);
    });

    it('should allow overriding pool size via config', () => {
      mockConfig({ DB_POOL_MAX: 50, DB_POOL_MIN: 5 });
      const options = databaseConfig.createTypeOrmOptions();
      expect((options as any).extra.max).toBe(50);
      expect((options as any).extra.min).toBe(5);
    });

    it('should enable SSL with rejectUnauthorized: true in production', () => {
      mockConfig({ NODE_ENV: 'production', DB_SSL_CA: '/ca.crt' });
      const options = databaseConfig.createTypeOrmOptions();
      expect(options.ssl).toBeTruthy();
      expect((options.ssl as any).rejectUnauthorized).toBe(true);
      expect((options.ssl as any).ca).toBe('/ca.crt');
    });

    it('should disable SSL in development when DB_SSL_ENABLED is false', () => {
      mockConfig({ NODE_ENV: 'development', DB_SSL_ENABLED: 'false' });
      expect(databaseConfig.createTypeOrmOptions().ssl).toBe(false);
    });

    it('should enable SSL in development when DB_SSL_ENABLED is true', () => {
      mockConfig({ NODE_ENV: 'development', DB_SSL_ENABLED: 'true' });
      const options = databaseConfig.createTypeOrmOptions();
      expect(options.ssl).toBeTruthy();
      expect((options.ssl as any).rejectUnauthorized).toBe(false);
    });

    it('should throw error when required configuration is missing', () => {
      jest.spyOn(configService, 'get').mockImplementation((key: string) => {
        if (key === 'DB_HOST') return undefined;
        return 'value';
      });
      expect(() => databaseConfig.createTypeOrmOptions()).toThrow(
        'Missing required database configuration: DB_HOST',
      );
    });

    it('should configure retry strategy', () => {
      mockConfig({ NODE_ENV: 'production' });
      const options: any = databaseConfig.createTypeOrmOptions();

      expect(options.retryAttempts).toBe(10);
      expect(options.retryDelay).toBe(3000);
      expect(typeof options.toRetry).toBe('function');

      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      for (let i = 1; i <= 9; i++) {
        expect(options.toRetry(new Error('test_error'))).toBe(true);
        expect(errorSpy).toHaveBeenCalledWith(
          `[TypeORM] Database connection attempt ${i} failed. Error: test_error`,
        );
        expect(exitSpy).not.toHaveBeenCalled();
      }

      expect(options.toRetry(new Error('final_error'))).toBe(true);
      expect(errorSpy).toHaveBeenCalledWith(
        `[TypeORM] Max connection retries (10) exhausted. Exiting...`,
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should set statement timeout and connection timeouts', () => {
      mockConfig({ NODE_ENV: 'production' });
      const options: any = databaseConfig.createTypeOrmOptions();
      expect(options.extra.statement_timeout).toBe(60000);
      expect(options.extra.connectionTimeoutMillis).toBe(2000);
      expect(options.extra.idleTimeoutMillis).toBe(30000);
    });

    it('should set application name', () => {
      mockConfig({ NODE_ENV: 'production' });
      const options: any = databaseConfig.createTypeOrmOptions();
      expect(options.extra.application_name).toBe('healthy-stellar-backend');
    });

    it('should default slow query threshold to 100ms', () => {
      mockConfig();
      expect(databaseConfig.createTypeOrmOptions().maxQueryExecutionTime).toBe(100);
    });

    it('should allow overriding slow query threshold', () => {
      mockConfig({ DB_SLOW_QUERY_MS: 250 });
      expect(databaseConfig.createTypeOrmOptions().maxQueryExecutionTime).toBe(250);
    });
  });
});
