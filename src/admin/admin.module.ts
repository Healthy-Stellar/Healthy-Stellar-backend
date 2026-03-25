import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiKey } from '../auth/entities/api-key.entity';
import { User } from '../auth/entities/user.entity';
import { AuditLogEntity } from '../common/audit/audit-log.entity';
import { ApiKeyService } from '../auth/services/api-key.service';
import { AuditService } from '../common/audit/audit.service';
import { AdminController } from './controllers/admin.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([ApiKey, User, AuditLogEntity]),
  ],
  controllers: [AdminController],
  providers: [ApiKeyService, AuditService],
  exports: [ApiKeyService],
})
export class AdminModule {}