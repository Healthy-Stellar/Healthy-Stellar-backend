import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';

// Controllers
import { HealthcareMonitoringController } from './controllers/healthcare-monitoring.controller';
import { ClinicalAlertsController } from './controllers/clinical-alerts.controller';
import { DashboardController } from './controllers/dashboard.controller';
import { ComplianceController } from './controllers/compliance.controller';
import { MonitoringController } from './controllers/monitoring.controller';

// Services
import { SystemHealthService } from './services/system-health.service';
import { ClinicalAlertService } from './services/clinical-alert.service';
import { EquipmentMonitoringService } from './services/equipment-monitoring.service';
import { ComplianceMonitoringService } from './services/compliance-monitoring.service';
import { IncidentTrackingService } from './services/incident-tracking.service';
import { DashboardService } from './services/dashboard.service';
import { NotificationService } from './services/notification.service';
import { VitalsService } from './services/vitals.service';
import { AlertRuleService } from './services/alert-rule.service';

// Gateway
import { VitalsGateway } from './vitals.gateway';

// Entities
import { SystemMetric } from './entities/system-metric.entity';
import { ClinicalAlert } from './entities/clinical-alert.entity';
import { EquipmentStatus } from './entities/equipment-status.entity';
import { ComplianceCheck } from './entities/compliance-check.entity';
import { HealthcareIncident } from './entities/healthcare-incident.entity';
import { PatientVital } from './entities/patient-vital.entity';
import { AlertRule } from './entities/alert-rule.entity';

// WS middleware/guard deps
import { WsJwtMiddleware } from '../notifications/middleware/ws-jwt.middleware';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SystemMetric,
      ClinicalAlert,
      EquipmentStatus,
      ComplianceCheck,
      HealthcareIncident,
      PatientVital,
      AlertRule,
    ]),
    ScheduleModule.forRoot(),
    AuthModule,
    NotificationsModule,
  ],
  controllers: [
    HealthcareMonitoringController,
    ClinicalAlertsController,
    DashboardController,
    ComplianceController,
    MonitoringController,
  ],
  providers: [
    SystemHealthService,
    ClinicalAlertService,
    EquipmentMonitoringService,
    ComplianceMonitoringService,
    IncidentTrackingService,
    DashboardService,
    NotificationService,
    VitalsService,
    AlertRuleService,
    VitalsGateway,
    WsJwtMiddleware,
  ],
  exports: [
    SystemHealthService,
    ClinicalAlertService,
    EquipmentMonitoringService,
    ComplianceMonitoringService,
    IncidentTrackingService,
    VitalsService,
    VitalsGateway,
    AlertRuleService,
  ],
})
export class HealthcareMonitoringModule {}
