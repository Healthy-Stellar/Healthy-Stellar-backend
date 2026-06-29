import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { QUEUE_NAMES } from '../../queues/queue.constants';

interface PanicAlertJobData {
  patientId?: string;
  patientLocation?: string;
  emergencyType: string;
  requestingStaffId?: string;
  requestingStaffName?: string;
  ward?: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

@Processor(QUEUE_NAMES.PANIC_ALERTS)
export class PanicAlertProcessor extends WorkerHost {
  private readonly logger = new Logger(PanicAlertProcessor.name);

  async process(job: Job<PanicAlertJobData>): Promise<void> {
    this.logger.log('Processing panic alert job ' + job.id + ' type=' + job.data.emergencyType);

    const { patientLocation, emergencyType, requestingStaffName, ward, timestamp } = job.data;

    const channels: string[] = [];
    const channelErrors: string[] = [];

    channels.push('in-app');

    try {
      await this.sendSmsAlert({ patientLocation, emergencyType, requestingStaffName, ward, timestamp });
      channels.push('sms');
    } catch (err) {
      channelErrors.push('sms: ' + (err instanceof Error ? err.message : String(err)));
    }

    try {
      await this.sendEmailAlert({ patientLocation, emergencyType, requestingStaffName, ward, timestamp });
      channels.push('email');
    } catch (err) {
      channelErrors.push('email: ' + (err instanceof Error ? err.message : String(err)));
    }

    if (channelErrors.length > 0) {
      this.logger.warn(
        'Panic alert job ' + job.id + ' had channel failures: ' + channelErrors.join('; '),
      );
    }

    this.logger.log(
      'Panic alert job ' + job.id + ' dispatched via channels: ' + channels.join(', '),
    );
  }

  private async sendSmsAlert(data: Record<string, any>): Promise<void> {
    this.logger.debug('SMS alert simulated for: ' + JSON.stringify(data));
    await this.delay(50);
  }

  private async sendEmailAlert(data: Record<string, any>): Promise<void> {
    this.logger.debug('Email alert simulated for: ' + JSON.stringify(data));
    await this.delay(50);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log('Panic alert job ' + job.id + ' completed');
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error('Panic alert job ' + job?.id + ' failed: ' + error.message);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
