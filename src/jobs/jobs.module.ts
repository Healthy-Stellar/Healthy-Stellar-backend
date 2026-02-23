import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccessGrant } from '../access-control/entities/access-grant.entity';
import { CommonModule } from '../common/common.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AccessGrantCleanupTask } from './access-grant-cleanup.task';

@Module({
  imports: [TypeOrmModule.forFeature([AccessGrant]), NotificationsModule, CommonModule],
  providers: [AccessGrantCleanupTask],
})
export class JobsModule {}
