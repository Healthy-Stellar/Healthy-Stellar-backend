import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import * as promClient from 'prom-client';
import { SlowQuerySubscriber } from './slow-query.subscriber';
import { SlowQueryAlertService } from './slow-query-alert.service';

function buildMockDataSource() {
  return { subscribers: [] };
}

describe('SlowQuerySubscriber', () => {
  let subscriber: SlowQuerySubscriber;
  let alertService: SlowQueryAlertService;

  beforeEach(async () => {
    // Clear prom-client default registry so metric re-registration doesn't throw
    promClient.register.clear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SlowQuerySubscriber,
        SlowQueryAlertService,
        {
          provide: getDataSourceToken(),
          useValue: buildMockDataSource(),
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string, def: any) => {
              if (key === 'SLOW_QUERY_THRESHOLD_MS') return 100; // low threshold for testing
              return def;
            }),
          },
        },
      ],
    }).compile();

    subscriber = module.get(SlowQuerySubscriber);
    alertService = module.get(SlowQueryAlertService);
  });

  it('records a slow query when execution time exceeds threshold', () => {
    const mockQr = {} as any;
    mockQr.__slowQueryStart = Date.now() - 200; // simulate 200ms query

    subscriber.afterQuery({
      query: 'SELECT pg_sleep(0.2)',
      parameters: [],
      queryRunner: mockQr,
    });

    const queries = subscriber.getSlowQueries();
    expect(queries).toHaveLength(1);
    expect(queries[0].sql).toContain('SELECT');
    expect(queries[0].durationMs).toBeGreaterThanOrEqual(100);
  });

  it('does NOT record a fast query below the threshold', () => {
    const mockQr = {} as any;
    mockQr.__slowQueryStart = Date.now() - 10; // 10ms — below 100ms threshold

    subscriber.afterQuery({
      query: 'SELECT 1',
      parameters: [],
      queryRunner: mockQr,
    });

    expect(subscriber.getSlowQueries()).toHaveLength(0);
  });

  it('keeps at most 100 entries in the store', () => {
    for (let i = 0; i < 120; i++) {
      const mockQr = {} as any;
      mockQr.__slowQueryStart = Date.now() - 200;
      subscriber.afterQuery({ query: `SELECT ${i}`, parameters: [], queryRunner: mockQr });
    }

    expect(subscriber.getSlowQueries().length).toBeLessThanOrEqual(100);
  });

  it('sends an ops alert when more than 10 slow queries occur in a 1-minute window', async () => {
    const alertSpy = jest.spyOn(alertService, 'sendOpsAlert').mockResolvedValue();

    for (let i = 0; i < 11; i++) {
      const mockQr = {} as any;
      mockQr.__slowQueryStart = Date.now() - 200;
      subscriber.afterQuery({ query: `SELECT slow_${i}`, parameters: [], queryRunner: mockQr });
    }

    // Allow microtasks to flush
    await Promise.resolve();

    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(alertSpy).toHaveBeenCalledWith(expect.any(Number), expect.any(Number));
  });

  it('sanitizes SSNs and card numbers from SQL before logging', () => {
    const mockQr = {} as any;
    mockQr.__slowQueryStart = Date.now() - 200;

    subscriber.afterQuery({
      query: "SELECT * FROM patients WHERE ssn = '123-45-6789' AND card = '1234567890123456'",
      parameters: [],
      queryRunner: mockQr,
    });

    const entry = subscriber.getSlowQueries()[0];
    expect(entry.sql).not.toContain('123-45-6789');
    expect(entry.sql).not.toContain('1234567890123456');
    expect(entry.sql).toContain('[SSN]');
    expect(entry.sql).toContain('[CARD]');
  });
});
