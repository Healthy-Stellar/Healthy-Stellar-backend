import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReconciliationRun } from './reconciliation-run.entity';
import { LedgerReconciliationReport } from './ledger-reconciliation-report.entity';
import { Record } from '../records/entities/record.entity';
import { LedgerReconciliationService } from './ledger-reconciliation.service';
import { StellarBalanceReconciliationService } from './stellar-balance-reconciliation.service';
import { ReconciliationJob } from './reconciliation.job';
import { ReconciliationController } from './reconciliation.controller';
import { ReconciliationDiscrepanciesCounter } from './reconciliation.metrics';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ReconciliationRun, LedgerReconciliationReport, Record]),
    NotificationsModule,
  ],
  controllers: [ReconciliationController],
  providers: [
    LedgerReconciliationService,
    StellarBalanceReconciliationService,
    ReconciliationJob,
    ReconciliationDiscrepanciesCounter,
  ],
  exports: [LedgerReconciliationService, StellarBalanceReconciliationService],
})
export class LedgerReconciliationModule {}
