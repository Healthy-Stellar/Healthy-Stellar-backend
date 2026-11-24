import { GUARDS_METADATA } from '@nestjs/common/constants';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { MetricsAuthGuard } from '../guards/metrics-auth.guard';
import { PrometheusMetricsController } from './prometheus-metrics.controller';

describe('PrometheusMetricsController', () => {
  it('is mounted at /metrics and protected by MetricsAuthGuard', () => {
    PrometheusModule.register({
      controller: PrometheusMetricsController,
      path: '/metrics',
      defaultMetrics: { enabled: false },
    });

    const guards = (Reflect.getMetadata(GUARDS_METADATA, PrometheusMetricsController) ??
      []) as unknown[];

    expect(guards).toContain(MetricsAuthGuard);
    expect(Reflect.getMetadata('path', PrometheusMetricsController)).toBe('/metrics');
  });
});
