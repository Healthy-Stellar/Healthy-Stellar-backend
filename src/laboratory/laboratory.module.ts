import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LabTest } from './entities/lab-test.entity';
import { LabOrder } from './entities/lab-order.entity';
import { LabResult } from './entities/lab-result.entity';
import { LabResultValue } from './entities/lab-result-value.entity';
import { LabOrderItem } from './entities/lab-order-item.entity';
import { LabTestParameter } from './entities/lab-test-parameter.entity';
import { Specimen } from './entities/specimen.entity';
import { CriticalValueAlert } from './entities/critical-value-alert.entity';
import { CriticalValueDefinition } from './entities/critical-value-definition.entity';
import { LaboratoryController } from './controllers/laboratory.controller';
import { LaboratoryService } from './services/laboratory.service';
import { LabResultsService } from './services/lab-results.service';
import { CriticalAlertsService } from './services/critical-alerts.service';
import { CriticalValueDefinitionsService } from './services/critical-value-definitions.service';
import { CriticalValueEventHandler } from './handlers/critical-value.handler';
import { LabResultsController } from './controllers/lab-results.controller';
import { CriticalValuesController } from './controllers/critical-values.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LabTest,
      LabOrder,
      LabResult,
      LabResultValue,
      LabOrderItem,
      LabTestParameter,
      Specimen,
      CriticalValueAlert,
      CriticalValueDefinition,
    ]),
    NotificationsModule,
  ],
  controllers: [LaboratoryController, LabResultsController, CriticalValuesController],
  providers: [
    LaboratoryService,
    LabResultsService,
    CriticalAlertsService,
    CriticalValueDefinitionsService,
    CriticalValueEventHandler,
  ],
  exports: [LaboratoryService, CriticalAlertsService],
})
export class LaboratoryModule {}
