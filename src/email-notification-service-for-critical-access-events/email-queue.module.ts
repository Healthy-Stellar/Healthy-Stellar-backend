// src/queue/email-queue.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailQueueProducer } from './email-queue.producer';
import { EmailQueueConsumer } from './email-queue.consumer';
import { EmailLookupService } from './email-lookup.service';
import { MailModule } from '../mail/mail.module';
import { Patient } from '../patients/entities/patient.entity';
import { User } from '../auth/entities/user.entity';
import { MedicalRecord } from '../medical-records/entities/medical-record.entity';
import { AuditLogEntity } from '../common/audit/audit-log.entity';

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
    TypeOrmModule.forFeature([Patient, User, MedicalRecord, AuditLogEntity]),
    MailModule,
  ],
  providers: [EmailQueueProducer, EmailQueueConsumer, EmailLookupService],
  exports: [EmailQueueProducer],
})
export class EmailQueueModule {}
