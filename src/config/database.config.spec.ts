import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DatabaseConfig } from './database.config';

describe('DatabaseConfig', () => {
  let databaseConfig: DatabaseConfig;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DatabaseConfig,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    databaseConfig = module.get<DatabaseConfig>(DatabaseConfig);
    configService = module.get<ConfigService>(ConfigService);
  });

  describe('createTypeOrmOptions', () => {
    it('should create TypeORM options with required configuration', () => {
      // Arrange
      jest.spyOn(configService, 'get').mockImplementation((key: string, defaultValue?: any) => {
        const config = {
          NODE_ENV: 'development',
          DB_HOST: 'localhost',
          DB_PORT: 5432,
          DB_USERNAME: 'test_user',
          DB_PASSWORD: 'test_password',
          DB_NAME: 'test_db',
          DB_SSL_ENABLED: 'false',
          DB_POOL_MAX: 20,
          DB_POOL_MIN: 2,
        };
        return config[key] || defaultValue;
      });

      // Act
      const options = databaseConfig.createTypeOrmOptions();

      // Assert
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
      // Arrange
      jest.spyOn(configService, 'get').mockImplementation((key: string, defaultValue?: any) => {
        const config = {
          NODE_ENV: 'production',
          DB_HOST: 'localhost',
          DB_PORT: 5432,
          DB_USERNAME: 'test_user',
          DB_PASSWORD: 'test_password',
          DB_NAME: 'test_db',
        };
        return config[key] || defaultValue;
      });

      // Act
      const options = databaseConfig.createTypeOrmOptions();

      // Assert
      expect(options.synchronize).toBe(false);
    });

    it('should configure SSL when enabled in production', () => {
      // Arrange
      jest.spyOn(configService, 'get').mockImplementation((key: string, defaultValue?: any) => {
        const config = {
          NODE_ENV: 'production',
          DB_HOST: 'localhost',
          DB_PORT: 5432,
          DB_USERNAME: 'test_user',
          DB_PASSWORD: 'test_password',
          DB_NAME: 'test_db',
          DB_SSL_ENABLED: 'true',
          DB_SSL_CA: '/path/to/ca.crt',
          DB_SSL_CERT: '/path/to/cert.crt',
          DB_SSL_KEY: '/path/to/key.key',
        };
        return config[key] || defaultValue;
      });

      // Act
      const options = databaseConfig.createTypeOrmOptions();

      // Assert
      expect(options.ssl).toBeTruthy();
      expect(options.ssl).toHaveProperty('rejectUnauthorized', true);
      expect(options.ssl).toHaveProperty('ca', '/path/to/ca.crt');
    });

    it('should disable SSL when not enabled', () => {
      // Arrange
      jest.spyOn(configService, 'get').mockImplementation((key: string, defaultValue?: any) => {
        const config = {
          NODE_ENV: 'development',
          DB_HOST: 'localhost',
          DB_PORT: 5432,
          DB_USERNAME: 'test_user',
          DB_PASSWORD: 'test_password',
          DB_NAME: 'test_db',
          DB_SSL_ENABLED: 'false',
        };
        return config[key] || defaultValue;
      });

      // Act
      const options = databaseConfig.createTypeOrmOptions();

      // Assert
      expect(options.ssl).toBe(false);
    });

    it('should configure connection pool with custom values', () => {
      // Arrange
      jest.spyOn(configService, 'get').mockImplementation((key: string, defaultValue?: any) => {
        const config = {
          NODE_ENV: 'production',
          DB_HOST: 'localhost',
          DB_PORT: 5432,
          DB_USERNAME: 'test_user',
          DB_PASSWORD: 'test_password',
          DB_NAME: 'test_db',
          DB_POOL_MAX: 50,
          DB_POOL_MIN: 5,
        };
        return config[key] || defaultValue;
      });

      // Act
      const options = databaseConfig.createTypeOrmOptions();

      // Assert
      expect(options.extra.max).toBe(50);
      expect(options.extra.min).toBe(5);
    });

    it('should use default pool values when not specified', () => {
      // Arrange
      jest.spyOn(configService, 'get').mockImplementation((key: string, defaultValue?: any) => {
        const config = {
          NODE_ENV: 'development',
          DB_HOST: 'localhost',
          DB_PORT: 5432,
          DB_USERNAME: 'test_user',
          DB_PASSWORD: 'test_password',
          DB_NAME: 'test_db',
        };
        return config[key] || defaultValue;
      });

      // Act
      const options = databaseConfig.createTypeOrmOptions();

      // Assert
      expect(options.extra.max).toBe(20);
      expect(options.extra.min).toBe(2);
    });

    it('should enable query logging in development', () => {
      // Arrange
      jest.spyOn(configService, 'get').mockImplementation((key: string, defaultValue?: any) => {
        const config = {
          NODE_ENV: 'development',
          DB_HOST: 'localhost',
          DB_PORT: 5432,
          DB_USERNAME: 'test_user',
          DB_PASSWORD: 'test_password',
          DB_NAME: 'test_db',
        };
        return config[key] || defaultValue;
      });

      // Act
      const options = databaseConfig.createTypeOrmOptions();

      // Assert
      expect(options.logging).toEqual(['query', 'error', 'warn', 'migration']);
    });

    it('should limit logging in production', () => {
      // Arrange
      jest.spyOn(configService, 'get').mockImplementation((key: string, defaultValue?: any) => {
        const config = {
          NODE_ENV: 'production',
          DB_HOST: 'localhost',
          DB_PORT: 5432,
          DB_USERNAME: 'test_user',
          DB_PASSWORD: 'test_password',
          DB_NAME: 'test_db',
        };
        return config[key] || defaultValue;
      });

      // Act
      const options = databaseConfig.createTypeOrmOptions();

      // Assert
      expect(options.logging).toEqual(['error', 'warn', 'migration']);
    });

    it('should throw error when required configuration is missing', () => {
      // Arrange
      jest.spyOn(configService, 'get').mockImplementation((key: string) => {
        if (key === 'DB_HOST') return undefined;
        return 'value';
      });

      // Act & Assert
      expect(() => databaseConfig.createTypeOrmOptions()).toThrow(
        'Missing required database configuration: DB_HOST',
      );
    });

    it('should configure retry strategy', () => {
      // Arrange
      jest.spyOn(configService, 'get').mockImplementation((key: string, defaultValue?: any) => {
        const config = {
          NODE_ENV: 'production',
          DB_HOST: 'localhost',
          DB_PORT: 5432,
          DB_USERNAME: 'test_user',
          DB_PASSWORD: 'test_password',
          DB_NAME: 'test_db',
        };
        return config[key] || defaultValue;
      });

      // Act
      const options = databaseConfig.createTypeOrmOptions();

      // Assert
      expect(options.retryAttempts).toBe(3);
      expect(options.retryDelay).toBe(3000);
    });

    it('should configure query cache', () => {
      // Arrange
      jest.spyOn(configService, 'get').mockImplementation((key: string, defaultValue?: any) => {
        const config = {
          NODE_ENV: 'production',
          DB_HOST: 'localhost',
          DB_PORT: 5432,
          DB_USERNAME: 'test_user',
          DB_PASSWORD: 'test_password',
          DB_NAME: 'test_db',
        };
        return config[key] || defaultValue;
      });

      // Act
      const options = databaseConfig.createTypeOrmOptions();

      // Assert
      expect(options.cache).toEqual({
        type: 'database',
        tableName: 'query_cache',
        duration: 60000,
      });
    });

    it('should set statement timeout for security', () => {
      // Arrange
      jest.spyOn(configService, 'get').mockImplementation((key: string, defaultValue?: any) => {
        const config = {
          NODE_ENV: 'production',
          DB_HOST: 'localhost',
          DB_PORT: 5432,
          DB_USERNAME: 'test_user',
          DB_PASSWORD: 'test_password',
          DB_NAME: 'test_db',
        };
        return config[key] || defaultValue;
      });

      // Act
      const options = databaseConfig.createTypeOrmOptions();

      // Assert
      expect(options.extra.statement_timeout).toBe(60000);
      expect(options.extra.connectionTimeoutMillis).toBe(30000);
      expect(options.extra.idleTimeoutMillis).toBe(600000);
    });

    it('should set application name for audit logging', () => {
      // Arrange
      jest.spyOn(configService, 'get').mockImplementation((key: string, defaultValue?: any) => {
        const config = {
          NODE_ENV: 'production',
          DB_HOST: 'localhost',
          DB_PORT: 5432,
          DB_USERNAME: 'test_user',
          DB_PASSWORD: 'test_password',
          DB_NAME: 'test_db',
        };
        return config[key] || defaultValue;
      });

      // Act
      const options = databaseConfig.createTypeOrmOptions();

      // Assert
      expect(options.extra.application_name).toBe('healthy-stellar-backend');
    });
  });
});
