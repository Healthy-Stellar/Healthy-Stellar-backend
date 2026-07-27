import {
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
  UpdateEvent,
  RemoveEvent,
} from 'typeorm';
import { Injectable } from '@nestjs/common';
import { QueryPerformanceMonitor } from '../services/query-performance-monitor.service';

/**
 * Query Performance Subscriber
 * 
 * Intercepts all TypeORM queries to monitor performance
 */
@Injectable()
@EventSubscriber()
export class QueryPerformanceSubscriber implements EntitySubscriberInterface {
  private queryStartTimes = new Map<string, number>();

  constructor(private readonly monitor: QueryPerformanceMonitor) {}

  beforeInsert(event: InsertEvent<any>) {
    this.trackQueryStart(event);
  }

  afterInsert(event: InsertEvent<any>) {
    this.trackQueryEnd(event, 'INSERT');
  }

  beforeUpdate(event: UpdateEvent<any>) {
    this.trackQueryStart(event);
  }

  afterUpdate(event: UpdateEvent<any>) {
    this.trackQueryEnd(event, 'UPDATE');
  }

  beforeRemove(event: RemoveEvent<any>) {
    this.trackQueryStart(event);
  }

  afterRemove(event: RemoveEvent<any>) {
    this.trackQueryEnd(event, 'DELETE');
  }

  private trackQueryStart(event: any) {
    const queryId = this.getQueryId(event);
    this.queryStartTimes.set(queryId, Date.now());
  }

  private trackQueryEnd(event: any, operation: string) {
    const queryId = this.getQueryId(event);
    const startTime = this.queryStartTimes.get(queryId);

    if (startTime) {
      const duration = Date.now() - startTime;
      this.monitor.recordQueryDuration(operation, duration, 'success');
      this.queryStartTimes.delete(queryId);
    }
  }

  private getQueryId(event: any): string {
    return `${event.metadata?.tableName || 'unknown'}_${Date.now()}_${Math.random()}`;
  }
}
