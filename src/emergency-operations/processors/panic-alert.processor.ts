import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger, Inject, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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

interface ChannelResult {
  channel: string;
  success: boolean;
  error?: string;
}

interface MailerServiceLike {
  sendMail(options: {
    to: string;
    subject: string;
    text: string;
    html?: string;
  }): Promise<any>;
}

@Processor(QUEUE_NAMES.PANIC_ALERTS)
export class PanicAlertProcessor extends WorkerHost {
  private readonly logger = new Logger(PanicAlertProcessor.name);

  constructor(
    @Optional() @Inject('MAILER_SERVICE') private readonly mailer?: MailerServiceLike,
    @Optional() private readonly configService?: ConfigService,
  ) {
    super();
    this.warnIfUnconfigured();
  }

  async process(job: Job<PanicAlertJobData>): Promise<void> {
    this.logger.log('Processing panic alert job ' + job.id + ' type=' + job.data.emergencyType);

    const { patientLocation, emergencyType, requestingStaffName, ward, timestamp } = job.data;

    const results: ChannelResult[] = [];

    results.push({ channel: 'in-app', success: true });

    const smsResult = await this.sendSmsAlert({
      patientLocation,
      emergencyType,
      requestingStaffName,
      ward,
      timestamp,
    });
    results.push(smsResult);

    const emailResult = await this.sendEmailAlert({
      patientLocation,
      emergencyType,
      requestingStaffName,
      ward,
      timestamp,
    });
    results.push(emailResult);

    const failures = results.filter((r) => !r.success);
    const delivered = results.filter((r) => r.success).map((r) => r.channel);

    await job.updateData({
      ...job.data,
      deliveryResults: results,
    });

    if (failures.length > 0) {
      const summary = failures
        .map((f) => f.channel + ': ' + (f.error ?? 'unknown error'))
        .join('; ');
      this.logger.error(
        'Panic alert job ' + job.id + ' delivery failures: ' + summary,
      );
    }

    if (delivered.length === 0) {
      throw new Error(
        'Panic alert job ' + job.id + ' reached no external channel: ' + failures
          .map((f) => f.channel + ': ' + (f.error ?? 'unknown error'))
          .join('; '),
      );
    }

    this.logger.log(
      'Panic alert job ' + job.id + ' dispatched via channels: ' + delivered.join(', '),
    );
  }

  private async sendSmsAlert(data: Record<string, any>): Promise<ChannelResult> {
    const to = this.configService?.get<string>('PANIC_ALERT_SMS_TO');
    const providerUrl = this.configService?.get<string>('SMS_PROVIDER_URL');
    const providerToken = this.configService?.get<string>('SMS_PROVIDER_TOKEN');
    const from = this.configService?.get<string>('SMS_PROVIDER_FROM');

    if (!to || !providerUrl || !providerToken) {
      const error =
        'SMS provider not configured (PANIC_ALERT_SMS_TO, SMS_PROVIDER_URL, SMS_PROVIDER_TOKEN required)';
      this.logger.error('Panic alert SMS channel unavailable: ' + error);
      return { channel: 'sms', success: false, error };
    }

    try {
      const response = await fetch(providerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + providerToken,
        },
        body: JSON.stringify({
          to,
          from,
          message: this.buildAlertMessage(data),
        }),
      });

      if (!response.ok) {
        const error = 'SMS provider responded with status ' + response.status;
        this.logger.error('Panic alert SMS delivery failed: ' + error);
        return { channel: 'sms', success: false, error };
      }

      return { channel: 'sms', success: true };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      this.logger.error('Panic alert SMS delivery failed: ' + error);
      return { channel: 'sms', success: false, error };
    }
  }

  private async sendEmailAlert(data: Record<string, any>): Promise<ChannelResult> {
    const to = this.configService?.get<string>('PANIC_ALERT_EMAIL_TO');

    if (!this.mailer) {
      const error = 'MAILER_SERVICE is not available';
      this.logger.error('Panic alert email channel unavailable: ' + error);
      return { channel: 'email', success: false, error };
    }

    if (!to) {
      const error = 'PANIC_ALERT_EMAIL_TO is not configured';
      this.logger.error('Panic alert email channel unavailable: ' + error);
      return { channel: 'email', success: false, error };
    }

    try {
      await this.mailer.sendMail({
        to,
        subject: 'PANIC ALERT: ' + data.emergencyType,
        text: this.buildAlertMessage(data),
      });
      return { channel: 'email', success: true };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      this.logger.error('Panic alert email delivery failed: ' + error);
      return { channel: 'email', success: false, error };
    }
  }

  private buildAlertMessage(data: Record<string, any>): string {
    return [
      'Emergency type: ' + data.emergencyType,
      'Location: ' + (data.patientLocation ?? 'unknown'),
      'Ward: ' + (data.ward ?? 'unknown'),
      'Requested by: ' + (data.requestingStaffName ?? 'unknown'),
      'Timestamp: ' + data.timestamp,
    ].join('\n');
  }

  private warnIfUnconfigured(): void {
    const smsConfigured = Boolean(
      this.configService?.get<string>('PANIC_ALERT_SMS_TO') &&
        this.configService?.get<string>('SMS_PROVIDER_URL') &&
        this.configService?.get<string>('SMS_PROVIDER_TOKEN'),
    );
    const emailConfigured = Boolean(
      this.mailer && this.configService?.get<string>('PANIC_ALERT_EMAIL_TO'),
    );

    if (smsConfigured || emailConfigured) {
      return;
    }

    const message =
      'No panic-alert delivery channel is configured (SMS and email both unavailable)'; 
    const isProduction = this.configService?.get<string>('NODE_ENV') === 'production';

    if (isProduction) {
      throw new Error(message + '; refusing to start in production');
    }

    this.logger.warn(message);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log('Panic alert job ' + job.id + ' completed');
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error('Panic alert job ' + job?.id + ' failed: ' + error.message);
  }
}
