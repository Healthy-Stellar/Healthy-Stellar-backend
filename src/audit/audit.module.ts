import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AuditLog } from './entities/audit-log.entity';
import { AuditService } from './services/audit.service';
import { AuditController } from './controllers/audit.controller';
import { AuditInterceptor } from './interceptors/audit.interceptor';

@Module({
  imports: [
    TypeOrmModule.forFeature([AuditLog]),
    EventEmitterModule.forRoot(),
  ],
  controllers: [AuditController],
  providers: [AuditService, AuditInterceptor],
  exports: [AuditService, AuditInterceptor],
})
export class AuditModule {}
