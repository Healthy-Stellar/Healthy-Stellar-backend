import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsModule } from '../notifications/notifications.module';
import { AccessGrant } from './entities/access-grant.entity';
import { AccessRequest } from './entities/access-request.entity';
import { BreakGlassAccess } from './entities/break-glass-access.entity';
import { User } from '../auth/entities/user.entity';
import { AccessControlService } from './services/access-control.service';
import { SorobanQueueService } from './services/soroban-queue.service';
import { BreakGlassService } from './services/break-glass.service';
import { AccessControlController } from './controllers/access-control.controller';
import { UsersEmergencyAccessController } from './controllers/users-emergency-access.controller';
import { AccessRequestController } from './controllers/access-request.controller';
import { BreakGlassController } from './controllers/break-glass.controller';
import { EmergencyAccessCleanupService } from './services/emergency-access-cleanup.service';
import { AccessRequestService } from './services/access-request.service';
import { RedisLockService } from '../common/utils/redis-lock.service';

@Module({
  imports: [TypeOrmModule.forFeature([AccessGrant, AccessRequest, BreakGlassAccess, User]), NotificationsModule],
  controllers: [AccessControlController, UsersEmergencyAccessController, AccessRequestController, BreakGlassController],
  providers: [AccessControlService, SorobanQueueService, EmergencyAccessCleanupService, AccessRequestService, BreakGlassService, RedisLockService],
  exports: [AccessControlService, AccessRequestService, EmergencyAccessCleanupService, BreakGlassService],
})
export class AccessControlModule {}
