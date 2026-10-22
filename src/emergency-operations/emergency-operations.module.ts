import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { EmergencyOperationsController } from './controllers/emergency-operations.controller';
import { EmergencyOperationsService } from './services/emergency-operations.service';
import { EmergencyTriageCase } from './entities/emergency-triage.entity';
import {
  CriticalCareAlert,
  CriticalCareMonitoring,
} from './entities/critical-care-monitoring.entity';
import { EmergencyResource } from './entities/emergency-resource.entity';
import { RapidResponseEvent } from './entities/rapid-response-event.entity';
import { DisasterIncident, EmergencyChartNote } from './entities/emergency-documentation.entity';
import { QUEUE_NAMES } from '../queues/queue.constants';
import { NotificationsModule } from '../notifications/notifications.module';

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
    BullModule.registerQueue({ name: QUEUE_NAMES.PANIC_ALERTS }),
    NotificationsModule,
  ],
  controllers: [EmergencyOperationsController],
  providers: [EmergencyOperationsService],
  exports: [EmergencyOperationsService],
})
export class EmergencyOperationsModule {}
