import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogEntity } from './audit-log.entity';
import { StellarModule } from '../../stellar/stellar.module';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { AuditLogsController } from './audit-logs.controller';
import { AuditInterceptor } from './audit.interceptor';
import { AuditChainService } from './audit-chain.service';
import { AuditChainController } from './audit-chain.controller';
import { AuditChainCron } from './audit-chain.cron';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLogEntity]), StellarModule],
  controllers: [AuditController, AuditLogsController, AuditChainController],
  providers: [AuditService, AuditInterceptor, AuditChainService, AuditChainCron],
  exports: [AuditService, AuditInterceptor, AuditChainService],
})
export class AuditModule {}
