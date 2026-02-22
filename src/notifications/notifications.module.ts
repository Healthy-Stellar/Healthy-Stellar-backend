import { Module } from '@nestjs/common';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsService } from './services/notifications.service';
import { NotificationQueueService } from './services/notification-queue.service';
import { WsAuthGuard } from './guards/ws-auth.guard';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [
    NotificationsGateway,
    NotificationsService,
    NotificationQueueService,
    WsAuthGuard,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
