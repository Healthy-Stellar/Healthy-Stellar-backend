import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SloService } from './slo.service';

describe('SloService', () => {
  let service: SloService;

  const mockFetch = jest.fn();

  beforeAll(() => {
    (global as any).fetch = mockFetch;
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SloService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('http://prometheus:9090') },
        },
      ],
    }).compile();

    service = module.get(SloService);
    mockFetch.mockReset();
  });

  function prometheusResponse(value: string) {
    return {
      ok: true,
      json: async () => ({
        status: 'success',
        data: { resultType: 'vector', result: [{ metric: {}, value: [Date.now() / 1000, value] }] },
      }),
    };
  }

  function emptyPrometheusResponse() {
    return {
      ok: true,
      json: async () => ({ status: 'success', data: { resultType: 'vector', result: [] } }),
    };
  }

  it('returns healthy status when error ratios are well below thresholds', async () => {
    // All 6 Prometheus queries return low error ratios and low budget consumption
    mockFetch.mockResolvedValue(prometheusResponse('0.0001'));

    const statuses = await service.getSloStatuses();
    expect(statuses).toHaveLength(3);
    statuses.forEach((s) => {
      expect(s.healthy).toBe(true);
      expect(s.currentErrorRatio).toBeCloseTo(0.0001);
      expect(s.errorBudgetConsumed).toBeCloseTo(0.0001);
      expect(s.errorBudgetRemainingPct).toBeGreaterThan(99);
    });
  });

  it('marks SLO unhealthy when error ratio exceeds fast-burn threshold', async () => {
    // api_availability fast-burn threshold = 0.0144
    // Return 0.02 for error ratio, 0.5 for budget consumed
    mockFetch
      .mockResolvedValueOnce(prometheusResponse('0.02'))  // api_availability error ratio
      .mockResolvedValueOnce(prometheusResponse('0.5'))   // api_availability budget consumed
      .mockResolvedValue(prometheusResponse('0.0001'));   // remaining SLOs fine

    const statuses = await service.getSloStatuses();
    expect(statuses[0].name).toBe('api_availability');
    expect(statuses[0].healthy).toBe(false);
    expect(statuses[1].healthy).toBe(true);
    expect(statuses[2].healthy).toBe(true);
  });

  it('clamps errorBudgetRemainingPct to 0 when budget is exhausted', async () => {
    mockFetch.mockResolvedValue(prometheusResponse('2.0')); // consumed = 200 %

    const statuses = await service.getSloStatuses();
    statuses.forEach((s) => {
      expect(s.errorBudgetRemainingPct).toBe(0);
    });
  });

  it('returns null fields when Prometheus returns no data', async () => {
    mockFetch.mockResolvedValue(emptyPrometheusResponse());

    const statuses = await service.getSloStatuses();
    statuses.forEach((s) => {
      expect(s.currentErrorRatio).toBeNull();
      expect(s.errorBudgetConsumed).toBeNull();
      expect(s.errorBudgetRemainingPct).toBeNull();
      expect(s.healthy).toBe(true); // defaults to healthy when no data
    });
  });

  it('returns null fields when Prometheus is unreachable', async () => {
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

    const statuses = await service.getSloStatuses();
    statuses.forEach((s) => {
      expect(s.currentErrorRatio).toBeNull();
      expect(s.errorBudgetConsumed).toBeNull();
    });
  });

  it('returns correct SLO names and targets', async () => {
    mockFetch.mockResolvedValue(emptyPrometheusResponse());

    const statuses = await service.getSloStatuses();
    expect(statuses[0]).toMatchObject({ name: 'api_availability',   target: 0.999 });
    expect(statuses[1]).toMatchObject({ name: 'api_latency_p99',    target: 0.990 });
    expect(statuses[2]).toMatchObject({ name: 'stellar_tx_success', target: 0.995 });
  });
});
