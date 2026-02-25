import { Injectable } from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Registry } from 'prom-client';

@Injectable()
export class MetricsService {
  constructor(
    @InjectMetric('PROM_REGISTRY')
    private readonly registry: Registry,
  ) {}

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  getContentType(): string {
    return this.registry.contentType;
  }
}
