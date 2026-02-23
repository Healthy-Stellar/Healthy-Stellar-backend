import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsModule } from '../notifications/notifications.module';
import { AccessGrant } from './entities/access-grant.entity';
import { User } from '../auth/entities/user.entity';
import { AccessControlService } from './services/access-control.service';
import { SorobanQueueService } from './services/soroban-queue.service';
import { AccessControlController } from './controllers/access-control.controller';
import { UsersEmergencyAccessController } from './controllers/users-emergency-access.controller';
import { EmergencyAccessCleanupService } from './services/emergency-access-cleanup.service';

@Module({
  imports: [TypeOrmModule.forFeature([AccessGrant, User]), NotificationsModule],
  controllers: [AccessControlController, UsersEmergencyAccessController],
  providers: [AccessControlService, SorobanQueueService, EmergencyAccessCleanupService],
  exports: [AccessControlService],
})
export class AccessControlModule {}
