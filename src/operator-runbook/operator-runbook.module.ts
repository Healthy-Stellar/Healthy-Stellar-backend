import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RunbookMapping } from './entities/runbook-mapping.entity';
import { RunbookService } from './services/runbook.service';
import { RunbookMappingController } from './controllers/runbook-mapping.controller';

@Module({
  imports: [TypeOrmModule.forFeature([RunbookMapping])],
  controllers: [RunbookMappingController],
  providers: [RunbookService],
  exports: [RunbookService],
})
export class OperatorRunbookModule {}
