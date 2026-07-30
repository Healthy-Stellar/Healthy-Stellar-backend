import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { QueryPerformanceInterceptor } from '../../src/common/interceptors/query-performance.interceptor';
import { DatabaseQueryGuard } from '../../src/common/guards/database-query.guard';
import { QueryPerformanceMonitor } from '../../src/common/services/query-performance-monitor.service';
import { Logger } from '../../src/common/logger/logger.service';
import { RequestTimeoutException, ServiceUnavailableException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { TimeoutError } from 'rxjs';

describe('Query Performance Guardrails', () => {
  let interceptor: QueryPerformanceInterceptor;
  let guard: DatabaseQueryGuard;
  let monitor: QueryPerformanceMonitor;
  let configService: ConfigService;
  let dataSource: DataSource;
  let logger: Logger;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueryPerformanceInterceptor,
        DatabaseQueryGuard,
        QueryPerformanceMonitor,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              const config = {
                REQUEST_TIMEOUT_MS: 30000,
                SLOW_QUERY_THRESHOLD_MS: 1000,
                DB_STATEMENT_TIMEOUT_MS: 10000,
                DB_POOL_THRESHOLD: 0.8,
                DB_POOL_MAX: 10,
              };
              return config[key] ?? defaultValue;
            }),
          },
        },
        {
          provide: DataSource,
          useValue: {
            query: jest.fn(),
            createQueryRunner: jest.fn(() => ({
              query: jest.fn(),
              release: jest.fn(),
            })),
            driver: {
              master: {
                totalCount: 5,
                idleCount: 3,
              },
            },
          },
        },
        {
          provide: Logger,
          useValue: {
            log: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
          },
        },
      ],
    }).compile();

    interceptor = module.get<QueryPerformanceInterceptor>(QueryPerformanceInterceptor);
    guard = module.get<DatabaseQueryGuard>(DatabaseQueryGuard);
    monitor = module.get<QueryPerformanceMonitor>(QueryPerformanceMonitor);
    configService = module.get<ConfigService>(ConfigService);
    dataSource = module.get<DataSource>(DataSource);
    logger = module.get<Logger>(Logger);
  });

  describe('QueryPerformanceInterceptor', () => {
    it('should be defined', () => {
      expect(interceptor).toBeDefined();
    });

    it('should throw RequestTimeoutException on timeout', (done) => {
      const context: any = {
        switchToHttp: () => ({
          getRequest: () => ({ url: '/test', method: 'GET' }),
        }),
      };

      const next: any = {
        handle: () => of(null).pipe(() => throwError(() => new TimeoutError())),
      };

      interceptor.intercept(context, next).subscribe({
        error: (error) => {
          expect(error).toBeInstanceOf(RequestTimeoutException);
          expect(logger.error).toHaveBeenCalledWith(
            'Request timeout exceeded',
            expect.objectContaining({
              path: '/test',
              method: 'GET',
            }),
          );
          done();
        },
      });
    });
  });

  describe('DatabaseQueryGuard', () => {
    it('should be defined', () => {
      expect(guard).toBeDefined();
    });

    it('should allow request when pool is healthy', async () => {
      const context: any = {
        switchToHttp: () => ({
          getRequest: () => ({ url: '/test' }),
        }),
      };

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
      expect(dataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('SET LOCAL statement_timeout'),
      );
    });

    it('should reject request when pool is exhausted', async () => {
      // Mock exhausted pool
      (dataSource.driver as any).master = {
        totalCount: 10,
        idleCount: 0,
      };

      const context: any = {
        switchToHttp: () => ({
          getRequest: () => ({ url: '/test' }),
        }),
      };

      await expect(guard.canActivate(context)).rejects.toThrow(ServiceUnavailableException);
      expect(logger.error).toHaveBeenCalledWith(
        'Database pool exhausted',
        expect.objectContaining({
          healthy: false,
        }),
      );
    });
  });

  describe('QueryPerformanceMonitor', () => {
    it('should be defined', () => {
      expect(monitor).toBeDefined();
    });

    it('should log slow queries', () => {
      const query = 'SELECT * FROM medical_record WHERE patient_id = $1';
      const duration = 1500;

      monitor.logSlowQuery(query, duration, ['123']);

      expect(logger.warn).toHaveBeenCalledWith(
        'Slow query detected',
        expect.objectContaining({
          duration: 1500,
          severity: 'warning',
        }),
      );
    });

    it('should log critical slow queries', () => {
      const query = 'SELECT * FROM medical_record';
      const duration = 6000;

      monitor.logSlowQuery(query, duration);

      expect(logger.error).toHaveBeenCalledWith(
        'Critical slow query detected',
        expect.objectContaining({
          duration: 6000,
        }),
      );
    });

    it('should sanitize sensitive data in queries', () => {
      const query = 'SELECT * FROM patient WHERE email = "test@example.com"';
      const duration = 1500;

      monitor.logSlowQuery(query, duration);

      expect(logger.warn).toHaveBeenCalledWith(
        'Slow query detected',
        expect.objectContaining({
          query: expect.stringContaining('[EMAIL]'),
        }),
      );
    });
  });
});
