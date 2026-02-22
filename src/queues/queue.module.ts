import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { BullBoardModule } from '@bull-board/nestjs';
import { ExpressAdapter } from '@bull-board/express';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QUEUE_NAMES } from './queue.constants';
import { QueueService } from './queue.service';
import { QueueController } from './queue.controller';
import { StellarTransactionProcessor } from './processors/stellar-transaction.processor';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get('REDIS_HOST', 'localhost'),
          port: configService.get('REDIS_PORT', 6379),
          password: configService.get('REDIS_PASSWORD'),
          db: configService.get('REDIS_DB', 0),
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue(
      { name: QUEUE_NAMES.STELLAR_TRANSACTIONS },
      { name: QUEUE_NAMES.IPFS_UPLOADS },
      { name: QUEUE_NAMES.EMAIL_NOTIFICATIONS },
    ),
    BullBoardModule.forRoot({
      route: '/admin/queues',
      adapter: ExpressAdapter,
    }),
    BullBoardModule.forFeature({
      name: QUEUE_NAMES.STELLAR_TRANSACTIONS,
      adapter: BullMQAdapter,
    }),
    BullBoardModule.forFeature({
      name: QUEUE_NAMES.IPFS_UPLOADS,
      adapter: BullMQAdapter,
    }),
    BullBoardModule.forFeature({
      name: QUEUE_NAMES.EMAIL_NOTIFICATIONS,
      adapter: BullMQAdapter,
    }),
  ],
  controllers: [QueueController],
  providers: [QueueService, StellarTransactionProcessor],
  exports: [QueueService],
})
export class QueueModule {}
