import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Runbook } from './entities/runbook.entity';
import { RunbookExecution } from './entities/runbook-execution.entity';
import { RunbookService } from './services/runbook.service';
import { RunbookController } from './controllers/runbook.controller';
import { AuditModule } from '../common/audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Runbook, RunbookExecution]),
    AuditModule,
  ],
  controllers: [RunbookController],
  providers: [RunbookService],
  exports: [RunbookService],
})
export class OperatorRunbookModule {}
