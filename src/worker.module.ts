import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { createRedisRetryStrategy } from './common/utils/connection-retry.util';
import { QUEUE_NAMES } from './queues/queue.constants';
import { ContractWritesProcessor } from './queues/processors/contract-writes.processor';
import { EventIndexingProcessor } from './queues/processors/event-indexing.processor';
import { StellarTransactionProcessor } from './queues/processors/stellar-transaction.processor';
import { BlockchainModule } from './blockchain/blockchain.module';
import { QueueEventsListener } from './queues/queue-events.listener';
import { DatabaseModule } from './database/database.module';
import { CommonModule } from './common/common.module';
import { QueueModule } from './queues/queue.module';

/**
 * WorkerModule
 *
 * Dedicated module for background job processing workers.
 * Runs queue processors without HTTP server components to prevent
 * resource starvation between different workload types.
 */
@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    // Database (needed for processors)
    DatabaseModule,

    // Common services (tracing, logging, etc.)
    CommonModule,

    // Blockchain services (needed for contract operations)
    BlockchainModule,

    // Redis connection for queues
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
        },
      }),
      inject: [ConfigService],
    }),

    // Register queues with optimized concurrency for worker processes
    BullModule.registerQueue(
      {
        name: QUEUE_NAMES.CONTRACT_WRITES,
        // Higher concurrency for contract writes in dedicated worker
      },
      {
        name: QUEUE_NAMES.STELLAR_TRANSACTIONS,
        // Moderate concurrency for transactions
      },
      {
        name: QUEUE_NAMES.EVENT_INDEXING,
        // Lower concurrency to maintain event ordering
      },
      {
        name: QUEUE_NAMES.IPFS_UPLOADS,
        // Moderate concurrency for uploads
      },
      {
        name: QUEUE_NAMES.EMAIL_NOTIFICATIONS,
        // High concurrency for notifications
      },
      {
        name: QUEUE_NAMES.REPORTS,
        // Low concurrency for reports
      },
    ),

    // Queue module with processors enabled
    QueueModule.forRoot({ isWorker: true }),
  ],
  providers: [
    // Queue processors (now handled by QueueModule.forRoot)
    // ContractWritesProcessor,
    // StellarTransactionProcessor,
    // EventIndexingProcessor,

    // Queue event listener for monitoring
    // QueueEventsListener, // Now in QueueModule
  ],
})
export class WorkerModule {}