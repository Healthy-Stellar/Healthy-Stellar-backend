import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { WebhooksController } from './webhooks.controller';
import { WebhookSignatureMiddleware } from '../common/middleware/webhook-signature.middleware';
import { RawBodyMiddleware } from '../common/middleware/raw-body.middleware';
import { IpfsService } from '../stellar/services/ipfs.service';
import { QueueService } from '../queues/queue.service';
import { WebhookSubscription } from './entities/webhook-subscription.entity';
import { WebhookDelivery } from './entities/webhook-delivery.entity';
import { WebhookDeliveryService } from './services/webhook-delivery.service';
import { WebhookDeliveryProcessor } from './processors/webhook-delivery.processor';
import { QUEUE_NAMES } from '../queues/queue.constants';
import { AuditModule } from '../common/audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([WebhookSubscription, WebhookDelivery]),
    BullModule.registerQueue({
      name: QUEUE_NAMES.WEBHOOK_DELIVERY,
    }),
    AuditModule,
  ],
  controllers: [WebhooksController],
  providers: [IpfsService, QueueService, WebhookDeliveryService, WebhookDeliveryProcessor],
  exports: [WebhookDeliveryService],
})
export class WebhooksModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Raw body must run first on all webhook routes so HMAC has the original bytes
    consumer.apply(RawBodyMiddleware).forRoutes(WebhooksController);

    // IPFS webhook — verified with IPFS_WEBHOOK_SECRET
    consumer
      .apply(new WebhookSignatureMiddleware('IPFS_WEBHOOK_SECRET') as any)
      .forRoutes({ path: 'webhooks/ipfs', method: RequestMethod.POST });

    // Stellar webhook — verified with STELLAR_WEBHOOK_SECRET
    consumer
      .apply(new WebhookSignatureMiddleware('STELLAR_WEBHOOK_SECRET') as any)
      .forRoutes({ path: 'webhooks/stellar', method: RequestMethod.POST });
  }
}

