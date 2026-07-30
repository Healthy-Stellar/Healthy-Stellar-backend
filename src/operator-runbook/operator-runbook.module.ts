import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
 main
import { RunbookMapping } from './entities/runbook-mapping.entity';
import { RunbookService } from './services/runbook.service';
import { RunbookMappingController } from './controllers/runbook-mapping.controller';

@Module({
  imports: [TypeOrmModule.forFeature([RunbookMapping])],
  controllers: [RunbookMappingController],

import { Runbook } from './entities/runbook.entity';
import { RunbookExecution } from './entities/runbook-execution.entity';
import { RunbookService } from './services/runbook.service';
import { RunbookMappingController } from './controllers/runbook-mapping.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Runbook, RunbookExecution]),
    AuditModule,
  ],
  controllers: [RunbookController],
 main
  providers: [RunbookService],
  exports: [RunbookService],
})
export class OperatorRunbookModule {}
