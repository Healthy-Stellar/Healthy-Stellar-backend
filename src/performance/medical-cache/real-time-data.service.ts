import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { EventEmitter } from 'events';

export interface RealTimeSubscription {
  id: string;
  channel: string;
  callback: (data: any) => void;
  filters?: Record<string, any>;
  createdAt: Date;
}

export interface RealTimeEvent {
  channel: string;
  type: 'update' | 'create' | 'delete' | 'alert';
  data: any;
  timestamp: Date;
  source: string;
  priority: 'critical' | 'high' | 'normal';
}

/**
 * Real-Time Data Service
 *
 * Provides real-time data access and event broadcasting for healthcare operations:
 * - Vital signs monitoring updates
 * - Lab result availability notifications
 * - Bed status changes
 * - Emergency alerts
 * - Medication administration notifications
 * - Patient admission/discharge events
 */
@Injectable()
export class RealTimeDataService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RealTimeDataService.name);
  private readonly emitter = new EventEmitter();
  private readonly subscriptions = new Map<string, RealTimeSubscription>();
  private readonly eventHistory: RealTimeEvent[] = [];
  private readonly MAX_HISTORY = 1000;
  private cleanupInterval: NodeJS.Timeout;

  // Healthcare-specific channels
  readonly CHANNELS = {
    PATIENT_VITALS: 'patient:vitals',
    PATIENT_ADMISSION: 'patient:admission',
    PATIENT_DISCHARGE: 'patient:discharge',
    LAB_RESULTS: 'lab:results',
    LAB_CRITICAL: 'lab:critical',
    MEDICATION_ALERT: 'medication:alert',
    MEDICATION_ADMINISTERED: 'medication:administered',
    BED_STATUS: 'bed:status',
    EMERGENCY_ALERT: 'emergency:alert',
    APPOINTMENT_UPDATE: 'appointment:update',
    STAFF_NOTIFICATION: 'staff:notification',
    SYSTEM_HEALTH: 'system:health',
    DEVICE_DATA: 'device:data',
    WORKFLOW_UPDATE: 'workflow:update',
  } as const;

  async onModuleInit(): Promise<void> {
    this.emitter.setMaxListeners(100);
    this.logger.log('📡 Real-time data service initialized');

    // Cleanup old event history every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupEventHistory();
    }, 300_000);
  }

  onModuleDestroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.emitter.removeAllListeners();
    this.subscriptions.clear();
  }

  /**
   * Subscribe to a real-time data channel.
   */
  subscribe(
    channel: string,
    callback: (event: RealTimeEvent) => void,
    filters?: Record<string, any>,
  ): string {
    const id = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const subscription: RealTimeSubscription = {
      id,
      channel,
      callback,
      filters,
      createdAt: new Date(),
    };

    this.subscriptions.set(id, subscription);

    const wrappedCallback = (event: RealTimeEvent) => {
      if (this.matchesFilters(event, filters)) {
        callback(event);
      }
    };

    this.emitter.on(channel, wrappedCallback);
    this.logger.debug(`Subscription created: ${id} on channel ${channel}`);

    return id;
  }

  /**
   * Unsubscribe from a channel.
   */
  unsubscribe(subscriptionId: string): boolean {
    const sub = this.subscriptions.get(subscriptionId);
    if (!sub) return false;

    this.emitter.removeListener(sub.channel, sub.callback);
    this.subscriptions.delete(subscriptionId);
    return true;
  }

  /**
   * Publish a real-time event to a channel.
   */
  publish(event: RealTimeEvent): void {
    // Store in history
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.MAX_HISTORY) {
      this.eventHistory.shift();
    }

    // Emit to subscribers
    this.emitter.emit(event.channel, event);

    // Critical events also emit on a universal critical channel
    if (event.priority === 'critical') {
      this.emitter.emit('critical:all', event);
      this.logger.warn(`🚨 Critical event on ${event.channel}: ${JSON.stringify(event.data)}`);
    }
  }

  /**
   * Publish patient vital signs update.
   */
  publishVitalsUpdate(
    patientId: string,
    vitals: {
      heartRate?: number;
      bloodPressureSystolic?: number;
      bloodPressureDiastolic?: number;
      temperature?: number;
      oxygenSaturation?: number;
      respiratoryRate?: number;
    },
  ): void {
    const isCritical = this.checkVitalsCritical(vitals);

    this.publish({
      channel: this.CHANNELS.PATIENT_VITALS,
      type: 'update',
      data: { patientId, vitals },
      timestamp: new Date(),
      source: 'vitals-monitor',
      priority: isCritical ? 'critical' : 'normal',
    });

    if (isCritical) {
      this.publish({
        channel: this.CHANNELS.EMERGENCY_ALERT,
        type: 'alert',
        data: {
          patientId,
          alertType: 'CRITICAL_VITALS',
          vitals,
          message: 'Critical vital signs detected – immediate attention required',
        },
        timestamp: new Date(),
        source: 'vitals-monitor',
        priority: 'critical',
      });
    }
  }

  /**
   * Publish lab result availability.
   */
  publishLabResult(
    patientId: string,
    labResult: {
      testName: string;
      result: any;
      isCritical: boolean;
      orderedBy: string;
    },
  ): void {
    const channel = labResult.isCritical ? this.CHANNELS.LAB_CRITICAL : this.CHANNELS.LAB_RESULTS;

    this.publish({
      channel,
      type: 'create',
      data: { patientId, ...labResult },
      timestamp: new Date(),
      source: 'laboratory',
      priority: labResult.isCritical ? 'critical' : 'normal',
    });
  }

  /**
   * Publish bed status change.
   */
  publishBedStatusChange(
    wardId: string,
    bedId: string,
    status: 'available' | 'occupied' | 'reserved' | 'maintenance',
    patientId?: string,
  ): void {
    this.publish({
      channel: this.CHANNELS.BED_STATUS,
      type: 'update',
      data: { wardId, bedId, status, patientId },
      timestamp: new Date(),
      source: 'ward-management',
      priority: 'normal',
    });
  }

  /**
   * Get recent events for a channel.
   */
  getRecentEvents(channel: string, limit: number = 50): RealTimeEvent[] {
    return this.eventHistory.filter((e) => e.channel === channel).slice(-limit);
  }

  /**
   * Get active subscription count per channel.
   */
  getSubscriptionStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    for (const sub of this.subscriptions.values()) {
      stats[sub.channel] = (stats[sub.channel] || 0) + 1;
    }
    return stats;
  }

  /**
   * Check if vital signs are in critical range.
   */
  private checkVitalsCritical(vitals: {
    heartRate?: number;
    bloodPressureSystolic?: number;
    bloodPressureDiastolic?: number;
    temperature?: number;
    oxygenSaturation?: number;
    respiratoryRate?: number;
  }): boolean {
    if (vitals.heartRate && (vitals.heartRate < 40 || vitals.heartRate > 150)) return true;
    if (
      vitals.bloodPressureSystolic &&
      (vitals.bloodPressureSystolic < 80 || vitals.bloodPressureSystolic > 200)
    )
      return true;
    if (vitals.oxygenSaturation && vitals.oxygenSaturation < 90) return true;
    if (vitals.temperature && (vitals.temperature < 35 || vitals.temperature > 40)) return true;
    if (vitals.respiratoryRate && (vitals.respiratoryRate < 8 || vitals.respiratoryRate > 35))
      return true;
    return false;
  }

  /**
   * Check if an event matches subscription filters.
   */
  private matchesFilters(event: RealTimeEvent, filters?: Record<string, any>): boolean {
    if (!filters) return true;

    for (const [key, value] of Object.entries(filters)) {
      if (event.data && event.data[key] !== value) {
        return false;
      }
    }

    return true;
  }

  /**
   * Cleanup old event history.
   */
  private cleanupEventHistory(): void {
    const cutoff = Date.now() - 3_600_000; // 1 hour
    const before = this.eventHistory.length;

    while (this.eventHistory.length > 0 && this.eventHistory[0].timestamp.getTime() < cutoff) {
      this.eventHistory.shift();
    }

    const removed = before - this.eventHistory.length;
    if (removed > 0) {
      this.logger.debug(`Cleaned up ${removed} old events from history`);
    }
  }
}
