import { Module, DynamicModule } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { createRedisRetryStrategy } from '../common/utils/connection-retry.util';
import { BullBoardModule } from '@bull-board/nestjs';
import { ExpressAdapter } from '@bull-board/express';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QUEUE_NAMES } from './queue.constants';
import { DLQ_BACKOFF_TYPE, DLQ_MAX_ATTEMPTS } from '../dlq/dlq-retry.strategy';
import { QueueService } from './queue.service';
import { QueueController } from './queue.controller';
import { EhrImportDlqController } from './controllers/ehr-import-dlq.controller';
import { StellarTransactionProcessor } from './processors/stellar-transaction.processor';
import { ContractWritesProcessor } from './processors/contract-writes.processor';
import { EventIndexingProcessor } from './processors/event-indexing.processor';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { QueueEventsListener } from './queue-events.listener';
import { RecordsModule } from '../records/records.module';
import { EventEmitterModule } from '@nestjs/event-emitter';

/**
 * QueueModule
 *
 * Supports two modes via the forRoot() factory:
 *
 *  isWorker: false (default — used by AppModule / HTTP server)
 *    Registers queues and QueueService so the HTTP layer can dispatch jobs.
 *    Does NOT register processor workers to avoid resource contention with
 *    the HTTP request pipeline.
 *
 *  isWorker: true (used by WorkerModule / dedicated worker process)
 *    Registers queues AND all @Processor workers so they actively consume
 *    jobs from Redis. The HTTP server is not started in this mode.
 */
@Module({})
export class QueueModule {
  static forRoot(options: { isWorker: boolean } = { isWorker: false }): DynamicModule {
    // Processors are only registered in worker mode to prevent the HTTP
    // server from competing with the dedicated worker process for jobs.
    const workerProviders = options.isWorker
      ? [
          StellarTransactionProcessor,
          ContractWritesProcessor,
          EventIndexingProcessor,
          QueueEventsListener,
        ]
      : [QueueEventsListener];

    return {
      module: QueueModule,
      imports: [
        // BlockchainModule provides StellarContractService used by ContractWritesProcessor.
        BlockchainModule,

        // RecordsModule provides RecordEventStoreService used by EventIndexingProcessor.
        RecordsModule,

        // EventEmitterModule is needed by EventIndexingProcessor to emit domain events.
        EventEmitterModule.forRoot(),

        // Redis connection shared by all queues.
        BullModule.forRootAsync({
          imports: [ConfigModule],
          useFactory: (configService: ConfigService) => ({
            connection: {
              host: configService.get('REDIS_HOST', 'localhost'),
              port: configService.get('REDIS_PORT', 6379),
              password: configService.get('REDIS_PASSWORD'),
              db: configService.get('REDIS_DB', 0),
              maxRetriesPerRequest: null,
              retryStrategy: createRedisRetryStrategy(),
              reconnectOnError: (err: Error) => {
                // Reconnect on READONLY errors (e.g. Redis failover / sentinel).
                return err.message.includes('READONLY');
              },
            },
            defaultJobOptions: {
              attempts: DLQ_MAX_ATTEMPTS,
              backoff: { type: DLQ_BACKOFF_TYPE },
              removeOnComplete: { count: 1000 },
              removeOnFail: { count: 5000 },
            },
          }),
          inject: [ConfigService],
        }),

        // Register all queues so both producers (QueueService) and consumers
        // (@Processor workers) can reference them by name.
        BullModule.registerQueue(
          { name: QUEUE_NAMES.STELLAR_TRANSACTIONS },
          { name: QUEUE_NAMES.CONTRACT_WRITES },
          { name: QUEUE_NAMES.IPFS_UPLOADS },
          { name: QUEUE_NAMES.EVENT_INDEXING },
          { name: QUEUE_NAMES.EMAIL_NOTIFICATIONS },
          { name: QUEUE_NAMES.REPORTS },
          { name: QUEUE_NAMES.EHR_IMPORT },
        ),

        // Bull Board dashboard — only useful when the HTTP server is running.
        BullBoardModule.forRoot({
          route: '/admin/queues',
          adapter: ExpressAdapter,
        }),
        BullBoardModule.forFeature({
          name: QUEUE_NAMES.STELLAR_TRANSACTIONS,
          adapter: BullMQAdapter,
        }),
        BullBoardModule.forFeature({
          name: QUEUE_NAMES.CONTRACT_WRITES,
          adapter: BullMQAdapter,
        }),
        BullBoardModule.forFeature({
          name: QUEUE_NAMES.IPFS_UPLOADS,
          adapter: BullMQAdapter,
        }),
        BullBoardModule.forFeature({
          name: QUEUE_NAMES.EVENT_INDEXING,
          adapter: BullMQAdapter,
        }),
        BullBoardModule.forFeature({
          name: QUEUE_NAMES.EMAIL_NOTIFICATIONS,
          adapter: BullMQAdapter,
        }),
        BullBoardModule.forFeature({
          name: QUEUE_NAMES.REPORTS,
          adapter: BullMQAdapter,
        }),
        BullBoardModule.forFeature({
          name: QUEUE_NAMES.EHR_IMPORT,
          adapter: BullMQAdapter,
        }),
      ],
      controllers: [QueueController, EhrImportDlqController],
      providers: [
        QueueService,
        ...workerProviders,
      ],
      exports: [QueueService, BullModule],
    };
  }
}
