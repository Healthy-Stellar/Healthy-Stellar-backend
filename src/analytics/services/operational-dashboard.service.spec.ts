import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OperationalDashboardService } from './operational-dashboard.service';

const mockDataSource = () => ({ query: jest.fn() });
const mockConfig = () => ({ get: jest.fn((_key: string, def: any) => def) });
const mockEventEmitter = () => ({ emit: jest.fn() });

describe('OperationalDashboardService', () => {
  let service: OperationalDashboardService;
  let dataSource: ReturnType<typeof mockDataSource>;
  let eventEmitter: ReturnType<typeof mockEventEmitter>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OperationalDashboardService,
        { provide: getDataSourceToken(), useFactory: mockDataSource },
        { provide: ConfigService, useFactory: mockConfig },
        { provide: EventEmitter2, useFactory: mockEventEmitter },
      ],
    }).compile();

    service = module.get(OperationalDashboardService);
    dataSource = module.get(getDataSourceToken());
    eventEmitter = module.get(EventEmitter2);
  });

  afterEach(() => jest.clearAllMocks());

  // ── getLiveDashboard ───────────────────────────────────────────────────────

  describe('getLiveDashboard', () => {
    it('aggregates bed and OR utilization into a single dashboard payload', async () => {
      dataSource.query
        .mockResolvedValueOnce([{ total: '100', occupied: '80' }])  // beds
        .mockResolvedValueOnce([{ total: '10', occupied: '8' }])    // ORs
        .mockResolvedValueOnce([{ upcoming: '3' }]);                 // upcoming

      const result = await service.getLiveDashboard('tenant-1');

      expect(result.tenantId).toBe('tenant-1');
      expect(result.bedUtilization.total).toBe(100);
      expect(result.bedUtilization.occupied).toBe(80);
      expect(result.bedUtilization.available).toBe(20);
      expect(result.bedUtilization.utilizationRate).toBe(80);
      expect(result.orUtilization.total).toBe(10);
      expect(result.orUtilization.occupied).toBe(8);
      expect(result.orUtilization.upcomingCases).toBe(3);
    });

    it('sets warningThresholdBreached=true when bed utilization exceeds 85%', async () => {
      dataSource.query
        .mockResolvedValueOnce([{ total: '100', occupied: '90' }])
        .mockResolvedValueOnce([{ total: '10', occupied: '5' }])
        .mockResolvedValueOnce([{ upcoming: '0' }]);

      const result = await service.getLiveDashboard('tenant-1');

      expect(result.bedUtilization.warningThresholdBreached).toBe(true);
      expect(result.orUtilization.warningThresholdBreached).toBe(false);
      expect(result.alerts).toHaveLength(1);
      expect(result.alerts[0]).toContain('Bed utilization');
    });

    it('sets both warning flags and two alerts when both thresholds are breached', async () => {
      dataSource.query
        .mockResolvedValueOnce([{ total: '100', occupied: '90' }])
        .mockResolvedValueOnce([{ total: '10', occupied: '9' }])
        .mockResolvedValueOnce([{ upcoming: '1' }]);

      const result = await service.getLiveDashboard('tenant-1');

      expect(result.bedUtilization.warningThresholdBreached).toBe(true);
      expect(result.orUtilization.warningThresholdBreached).toBe(true);
      expect(result.alerts).toHaveLength(2);
    });

    it('returns zero utilization without errors when no beds or ORs exist', async () => {
      dataSource.query
        .mockResolvedValueOnce([{ total: '0', occupied: '0' }])
        .mockResolvedValueOnce([{ total: '0', occupied: '0' }])
        .mockResolvedValueOnce([{ upcoming: '0' }]);

      const result = await service.getLiveDashboard('tenant-1');

      expect(result.bedUtilization.utilizationRate).toBe(0);
      expect(result.orUtilization.utilizationRate).toBe(0);
      expect(result.alerts).toHaveLength(0);
    });

    it('gracefully falls back to zero when database queries fail', async () => {
      dataSource.query.mockRejectedValue(new Error('DB down'));

      const result = await service.getLiveDashboard('tenant-1');

      expect(result.bedUtilization.total).toBe(0);
      expect(result.orUtilization.total).toBe(0);
    });
  });

  // ── publishDashboardUpdate ─────────────────────────────────────────────────

  describe('publishDashboardUpdate', () => {
    it('emits operational.dashboard.update with the fresh dashboard payload', async () => {
      dataSource.query
        .mockResolvedValueOnce([{ total: '50', occupied: '25' }])
        .mockResolvedValueOnce([{ total: '5', occupied: '2' }])
        .mockResolvedValueOnce([{ upcoming: '1' }]);

      await service.publishDashboardUpdate('tenant-1');

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'operational.dashboard.update',
        expect.objectContaining({ tenantId: 'tenant-1' }),
      );
    });
  });
});
