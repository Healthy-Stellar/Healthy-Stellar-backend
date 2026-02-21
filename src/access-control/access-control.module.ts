import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccessGrant } from './entities/access-grant.entity';
import { AccessControlService } from './services/access-control.service';
import { AccessControlController } from './controllers/access-control.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AccessGrant])],
  controllers: [AccessControlController],
  providers: [AccessControlService],
  exports: [AccessControlService],
})
export class AccessControlModule {}
