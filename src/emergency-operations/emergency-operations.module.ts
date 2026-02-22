import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmergencyOperationsController } from './controllers/emergency-operations.controller';
import { EmergencyOperationsService } from './services/emergency-operations.service';
import { EmergencyTriageCase } from './entities/emergency-triage.entity';
import {
  CriticalCareAlert,
  CriticalCareMonitoring,
} from './entities/critical-care-monitoring.entity';
import { EmergencyResource } from './entities/emergency-resource.entity';
import { RapidResponseEvent } from './entities/rapid-response-event.entity';
import {
  DisasterIncident,
  EmergencyChartNote,
} from './entities/emergency-documentation.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EmergencyTriageCase,
      CriticalCareMonitoring,
      CriticalCareAlert,
      EmergencyResource,
      RapidResponseEvent,
      EmergencyChartNote,
      DisasterIncident,
    ]),
  ],
  controllers: [EmergencyOperationsController],
  providers: [EmergencyOperationsService],
  exports: [EmergencyOperationsService],
})
export class EmergencyOperationsModule {}
