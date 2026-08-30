import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Runbook } from './entities/runbook.entity';
import { RunbookExecution } from './entities/runbook-execution.entity';
import { RunbookMapping } from './entities/runbook-mapping.entity';
import { RunbookService } from './services/runbook.service';
import { RunbookController } from './controllers/runbook.controller';
import { RunbookMappingController } from './controllers/runbook-mapping.controller';
import { AuditModule } from '../common/audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Runbook, RunbookExecution, RunbookMapping]),
    AuditModule,
  ],
  controllers: [RunbookController, RunbookMappingController],
  providers: [RunbookService],
  exports: [RunbookService],
})
export class OperatorRunbookModule {}
