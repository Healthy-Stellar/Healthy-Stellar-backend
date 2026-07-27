import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccessGrant } from '../access-control/entities/access-grant.entity';
import { CommonModule } from '../common/common.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { IdempotencyModule } from '../idempotency/idempotency.module';
import { AccessGrantCleanupTask } from './access-grant-cleanup.task';
import { IdempotencyCleanupTask } from './idempotency-cleanup.task';

@Module({
  imports: [TypeOrmModule.forFeature([AccessGrant]), NotificationsModule, CommonModule, IdempotencyModule],
  providers: [AccessGrantCleanupTask, IdempotencyCleanupTask],
})
export class JobsModule {}
