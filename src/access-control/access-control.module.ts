import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsModule } from '../notifications/notifications.module';
import { AccessGrant } from './entities/access-grant.entity';
import { AccessRequest } from './entities/access-request.entity';
import { User } from '../auth/entities/user.entity';
import { AccessControlService } from './services/access-control.service';
import { SorobanQueueService } from './services/soroban-queue.service';
import { AccessControlController } from './controllers/access-control.controller';
import { UsersEmergencyAccessController } from './controllers/users-emergency-access.controller';
import { AccessRequestController } from './controllers/access-request.controller';
import { EmergencyAccessCleanupService } from './services/emergency-access-cleanup.service';
import { AccessRequestService } from './services/access-request.service';
import { RedisLockService } from '../common/utils/redis-lock.service';

@Module({
  imports: [TypeOrmModule.forFeature([AccessGrant, AccessRequest, User]), NotificationsModule],
  controllers: [AccessControlController, UsersEmergencyAccessController, AccessRequestController],
  providers: [AccessControlService, SorobanQueueService, EmergencyAccessCleanupService, AccessRequestService, RedisLockService],
  exports: [AccessControlService, AccessRequestService],
  providers: [AccessControlService, SorobanQueueService, EmergencyAccessCleanupService, AccessRequestService],
  exports: [AccessControlService, AccessRequestService, EmergencyAccessCleanupService],
})
export class AccessControlModule {}
