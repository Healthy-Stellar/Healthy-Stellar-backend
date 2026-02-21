import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { WebhookSignatureMiddleware } from '../common/middleware/webhook-signature.middleware';
import { RawBodyMiddleware } from '../common/middleware/raw-body.middleware';

@Module({
  controllers: [WebhooksController],
})
export class WebhooksModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RawBodyMiddleware, WebhookSignatureMiddleware)
      .forRoutes(WebhooksController);
  }
}
