import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VirtualVisitController } from './controllers/virtual-visit.controller';
import { RemoteMonitoringController } from './controllers/remote-monitoring.controller';
import { TelemedicineDocumentationController } from './controllers/telemedicine-documentation.controller';
import { TelehealthBillingController } from './controllers/telehealth-billing.controller';
import { RemotePrescriptionController } from './controllers/remote-prescription.controller';
import { QualityOutcomeController } from './controllers/quality-outcome.controller';
import { VirtualVisitService } from './services/virtual-visit.service';
import { VideoConferenceService } from './services/video-conference.service';
import { RemoteMonitoringService } from './services/remote-monitoring.service';
import { TelemedicineDocumentationService } from './services/telemedicine-documentation.service';
import { TelehealthBillingService } from './services/telehealth-billing.service';
import { RemotePrescriptionService } from './services/remote-prescription.service';
import { QualityOutcomeService } from './services/quality-outcome.service';
import { HipaaComplianceService } from './services/hipaa-compliance.service';
import { VirtualVisit } from './entities/virtual-visit.entity';
import { RemoteMonitoringData } from './entities/remote-monitoring-data.entity';
import { TelemedicineDocument } from './entities/telemedicine-document.entity';
import { TelehealthBilling } from './entities/telehealth-billing.entity';
import { RemotePrescription } from './entities/remote-prescription.entity';
import { QualityOutcome } from './entities/quality-outcome.entity';
import { VideoConferenceSession } from './entities/video-conference-session.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      VirtualVisit,
      RemoteMonitoringData,
      TelemedicineDocument,
      TelehealthBilling,
      RemotePrescription,
      QualityOutcome,
      VideoConferenceSession,
    ]),
  ],
  controllers: [
    VirtualVisitController,
    RemoteMonitoringController,
    TelemedicineDocumentationController,
    TelehealthBillingController,
    RemotePrescriptionController,
    QualityOutcomeController,
  ],
  providers: [
    VirtualVisitService,
    VideoConferenceService,
    RemoteMonitoringService,
    TelemedicineDocumentationService,
    TelehealthBillingService,
    RemotePrescriptionService,
    QualityOutcomeService,
    HipaaComplianceService,
  ],
  exports: [VirtualVisitService, RemoteMonitoringService, QualityOutcomeService],
})
export class TelemedicineModule {}
