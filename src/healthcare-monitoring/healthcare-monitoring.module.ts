import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';

// Controllers
import { HealthcareMonitoringController } from './controllers/healthcare-monitoring.controller';
import { ClinicalAlertsController } from './controllers/clinical-alerts.controller';
import { DashboardController } from './controllers/dashboard.controller';
import { ComplianceController } from './controllers/compliance.controller';

// Services
import { SystemHealthService } from './services/system-health.service';
import { ClinicalAlertService } from './services/clinical-alert.service';
import { EquipmentMonitoringService } from './services/equipment-monitoring.service';
import { ComplianceMonitoringService } from './services/compliance-monitoring.service';
import { IncidentTrackingService } from './services/incident-tracking.service';
import { DashboardService } from './services/dashboard.service';
import { NotificationService } from './services/notification.service';

// Entities
import { SystemMetric } from './entities/system-metric.entity';
import { ClinicalAlert } from './entities/clinical-alert.entity';
import { EquipmentStatus } from './entities/equipment-status.entity';
import { ComplianceCheck } from './entities/compliance-check.entity';
import { HealthcareIncident } from './entities/healthcare-incident.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SystemMetric,
      ClinicalAlert,
      EquipmentStatus,
      ComplianceCheck,
      HealthcareIncident,
    ]),
    ScheduleModule.forRoot(),
  ],
  controllers: [
    HealthcareMonitoringController,
    ClinicalAlertsController,
    DashboardController,
    ComplianceController,
  ],
  providers: [
    SystemHealthService,
    ClinicalAlertService,
    EquipmentMonitoringService,
    ComplianceMonitoringService,
    IncidentTrackingService,
    DashboardService,
    NotificationService,
  ],
  exports: [
    SystemHealthService,
    ClinicalAlertService,
    EquipmentMonitoringService,
    ComplianceMonitoringService,
    IncidentTrackingService,
  ],
})
export class HealthcareMonitoringModule {}