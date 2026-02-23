// src/queue/email-queue.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EmailQueueProducer } from './email-queue.producer';
import { EmailQueueConsumer } from './email-queue.consumer';
import { MailModule } from '../mail/mail.module';

export const EMAIL_QUEUE = 'email-notifications';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
          password: config.get('REDIS_PASSWORD'),
        },
      }),
    }),
    BullModule.registerQueue({
      name: EMAIL_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000, // 2s → 4s → 8s
        },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    }),
    MailModule,
  ],
  providers: [EmailQueueProducer, EmailQueueConsumer],
  exports: [EmailQueueProducer],
})
export class EmailQueueModule {}
