import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { ApiKey } from '../auth/entities/api-key.entity';
import { User } from '../auth/entities/user.entity';
import { AuditLogEntity } from '../common/audit/audit-log.entity';
import { ApiKeyService } from '../auth/services/api-key.service';
import { AuditService } from '../common/audit/audit.service';
import { AdminController } from './controllers/admin.controller';
import { AdminPatientsController } from './controllers/admin-patients.controller';
import { AdminUserImportController } from './controllers/admin-user-import.controller';
import { PatientModule } from '../patients/patients.module';
import { IpAllowlistGuard } from '../common/guards/ip-allowlist.guard';
import { NotificationsModule } from '../notifications/notifications.module';
import { ApiKeyExpiryTask } from '../auth/tasks/api-key-expiry.task';
import { UserImportJob } from './entities/user-import-job.entity';
import { UserImportService } from './services/user-import.service';
import { UserImportProcessor } from './processors/user-import.processor';
import { QUEUE_NAMES } from '../queues/queue.constants';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([ApiKey, User, AuditLogEntity, UserImportJob]),
    BullModule.registerQueue({ name: QUEUE_NAMES.USER_CSV_IMPORT }),
    PatientModule,
    NotificationsModule,
  ],
  controllers: [AdminController, AdminPatientsController, AdminUserImportController],
  providers: [
    ApiKeyService,
    AuditService,
    IpAllowlistGuard,
    ApiKeyExpiryTask,
    UserImportService,
    UserImportProcessor,
  ],
  exports: [ApiKeyService],
})
export class AdminModule {}
