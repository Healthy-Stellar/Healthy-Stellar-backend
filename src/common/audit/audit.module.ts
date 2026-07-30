import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogEntity } from './audit-log.entity';
import { AuditLog } from '../entities/audit-log.entity';
import { SensitiveAuditLog } from '../entities/sensitive-audit-log.entity';
import { StellarModule } from '../../stellar/stellar.module';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { AuditLogsController } from './audit-logs.controller';
import { AuditInterceptor } from './audit.interceptor';
import { AuditChainService } from './audit-chain.service';
import { AuditChainController } from './audit-chain.controller';
import { AuditChainCron } from './audit-chain.cron';
import { AuditLogService } from '../services/audit-log.service';
import { PhiAuditInterceptor } from './phi-audit.interceptor';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLogEntity, AuditLog, SensitiveAuditLog]), StellarModule],
  controllers: [AuditController, AuditLogsController, AuditChainController],
  providers: [AuditService, AuditInterceptor, AuditChainService, AuditChainCron, AuditLogService, PhiAuditInterceptor],
  exports: [AuditService, AuditInterceptor, AuditChainService, AuditLogService, PhiAuditInterceptor],
})
export class AuditModule {}
