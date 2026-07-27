import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '../../queues/queue.constants';
import { WebhookDeliveryService } from '../services/webhook-delivery.service';

interface WebhookDeliveryJobData {
  deliveryId: string;
  subscriptionId: string;
  subscriptionUrl: string;
  eventType: string;
  eventPayload: Record<string, any>;
  subscriptionSecret?: string;
  customHeaders?: Record<string, string>;
  tenantId?: string | null;
}

@Processor(QUEUE_NAMES.WEBHOOK_DELIVERY)
export class WebhookDeliveryProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhookDeliveryProcessor.name);

  constructor(private readonly webhookService: WebhookDeliveryService) {
    super();
  }

  async process(job: Job<WebhookDeliveryJobData>): Promise<void> {
    this.logger.debug(`Processing webhook delivery job: ${job.id}`);
    const result = await this.webhookService.deliverWebhook(job);

    if (!result.success) {
      throw new Error(`Webhook delivery failed - will retry if attempts remain`);
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    this.logger.warn(`Webhook delivery job failed: ${job.id} - ${err.message}`);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.debug(`Webhook delivery job completed: ${job.id}`);
  }
}
