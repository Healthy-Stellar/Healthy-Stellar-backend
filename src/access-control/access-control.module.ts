import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsModule } from '../notifications/notifications.module';
import { AccessGrant } from './entities/access-grant.entity';
import { AccessControlService } from './services/access-control.service';
import { SorobanQueueService } from './services/soroban-queue.service';
import { AccessControlController } from './controllers/access-control.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AccessGrant]), NotificationsModule],
  controllers: [AccessControlController],
  providers: [AccessControlService, SorobanQueueService],
  exports: [AccessControlService],
})
export class AccessControlModule {}
