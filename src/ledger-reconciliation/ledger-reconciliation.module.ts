import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReconciliationRun } from './reconciliation-run.entity';
import { Record } from '../records/entities/record.entity';
import { LedgerReconciliationService } from './ledger-reconciliation.service';
import { ReconciliationJob } from './reconciliation.job';
import { ReconciliationController } from './reconciliation.controller';
import { ReconciliationDiscrepanciesCounter } from './reconciliation.metrics';

@Module({
  imports: [TypeOrmModule.forFeature([ReconciliationRun, Record])],
  controllers: [ReconciliationController],
  providers: [
    LedgerReconciliationService,
    ReconciliationJob,
    ReconciliationDiscrepanciesCounter,
  ],
  exports: [LedgerReconciliationService],
})
export class LedgerReconciliationModule {}
