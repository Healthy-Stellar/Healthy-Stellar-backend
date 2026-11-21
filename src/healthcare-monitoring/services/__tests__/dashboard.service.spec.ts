import { DashboardService } from '../dashboard.service';

describe('DashboardService', () => {
  let service: DashboardService;

  beforeEach(() => {
    service = new DashboardService();
  });

  describe('getSystemHealthDashboard', () => {
    it('does not return random mock metrics', async () => {
      const dashboard = await service.getSystemHealthDashboard();

      expect(dashboard).toBeDefined();
      expect(dashboard.metricsAvailable).toBe(false);
      expect(dashboard.throughput).toBeNull();
      expect(dashboard.errorRate).toBeNull();
      expect(dashboard.disk).toBeNull();
      expect(dashboard.network).toBeNull();
    });

    it('returns stable values across repeated calls', async () => {
      const first = await service.getSystemHealthDashboard();
      const second = await service.getSystemHealthDashboard();

      expect(first.throughput).toEqual(second.throughput);
      expect(first.errorRate).toEqual(second.errorRate);
      expect(first.disk).toEqual(second.disk);
      expect(first.network).toEqual(second.network);
    });
  });

  describe('getClinicalDashboard', () => {
    it('does not return random mock counts', async () => {
      const dashboard = await service.getClinicalDashboard();

      expect(dashboard).toBeDefined();
      expect(dashboard.metricsAvailable).toBe(false);
      expect(dashboard.scheduled).toBeNull();
      expect(dashboard.high).toBeNull();
      expect(dashboard.medium).toBeNull();
      expect(dashboard.low).toBeNull();
      expect(dashboard.improving).toBeNull();
    });

    it('returns stable values across repeated calls', async () => {
      const first = await service.getClinicalDashboard();
      const second = await service.getClinicalDashboard();

      expect(first.scheduled).toEqual(second.scheduled);
      expect(first.high).toEqual(second.high);
      expect(first.medium).toEqual(second.medium);
      expect(first.low).toEqual(second.low);
      expect(first.improving).toEqual(second.improving);
    });
  });
});
