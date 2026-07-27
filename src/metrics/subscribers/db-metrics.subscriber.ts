import {
  EventSubscriber,
  EntitySubscriberInterface,
  InsertEvent,
  UpdateEvent,
  RemoveEvent,
  SelectQueryBuilder,
} from 'typeorm';
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CustomMetricsService } from '../custom-metrics.service';

/**
 * TypeORM subscriber that records db_query_duration_seconds for
 * insert / update / remove lifecycle hooks.
 *
 * For SELECT queries, use CustomMetricsService.recordDbQuery() directly
 * in repository methods, since TypeORM doesn't expose a generic beforeQuery hook.
 */
@Injectable()
@EventSubscriber()
export class DbMetricsSubscriber implements EntitySubscriberInterface {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly metrics: CustomMetricsService,
  ) {
    dataSource.subscribers.push(this);
  }

  // ── Insert ──────────────────────────────────────────────────────────────────

  beforeInsert(event: InsertEvent<any>) {
    (event as any).__metricsStart = Date.now();
  }

  afterInsert(event: InsertEvent<any>) {
    const start: number = (event as any).__metricsStart;
    if (start) {
      const entity = event.metadata?.name ?? 'unknown';
      this.metrics.recordDbQuery('insert', entity, (Date.now() - start) / 1000);
    }
  }

  // ── Update ──────────────────────────────────────────────────────────────────

  beforeUpdate(event: UpdateEvent<any>) {
    (event as any).__metricsStart = Date.now();
  }

  afterUpdate(event: UpdateEvent<any>) {
    const start: number = (event as any).__metricsStart;
    if (start) {
      const entity = event.metadata?.name ?? 'unknown';
      this.metrics.recordDbQuery('update', entity, (Date.now() - start) / 1000);
    }
  }

  // ── Remove ──────────────────────────────────────────────────────────────────

  beforeRemove(event: RemoveEvent<any>) {
    (event as any).__metricsStart = Date.now();
  }

  afterRemove(event: RemoveEvent<any>) {
    const start: number = (event as any).__metricsStart;
    if (start) {
      const entity = event.metadata?.name ?? 'unknown';
      this.metrics.recordDbQuery('remove', entity, (Date.now() - start) / 1000);
    }
  }
}
