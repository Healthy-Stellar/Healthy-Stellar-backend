import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { GdprController } from './controllers/gdpr.controller';
import { GdprService } from './services/gdpr.service';
import { DeletionRegistryService } from './services/deletion-registry.service';
import { GdprRequest } from './entities/gdpr-request.entity';
import { GdprProcessor } from './processors/gdpr.processor';
import { AuthModule } from '../auth/auth.module';
import { PatientModule } from '../patients/patients.module';
import { RecordsModule } from '../records/records.module';
import { MedicalRecordsModule } from '../medical-records/medical-records.module';
import { AccessControlModule } from '../access-control/access-control.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { StellarModule } from '../stellar/stellar.module';
import { DataRetentionModule } from '../data-retention/data-retention.module';
import { User } from '../auth/entities/user.entity';
import { Patient } from '../patients/entities/patient.entity';
import { Record } from '../records/entities/record.entity';
import { MedicalRecord } from '../medical-records/entities/medical-record.entity';
import { AccessGrant } from '../access-control/entities/access-grant.entity';
import { AuditLogEntity } from '../common/audit/audit-log.entity';
import { GdprComplianceLog } from './entities/gdpr-compliance-log.entity';
import { BillingEntity } from '../billing/entities/billing.entity';
import { InsuranceClaim } from '../billing/entities/insurance-claim.entity';
import { Insurance } from '../billing/entities/insurance.entity';
import { Payment } from '../billing/entities/payment.entity';
import { MedicationAdministrationRecord } from '../medication-administration/entities/medication-administration-record.entity';
import { MedicationOrder } from '../medication-administration/entities/medication-order.entity';
import { AdverseDrugReaction } from '../medication-administration/entities/adverse-drug-reaction.entity';
import { MedicationReconciliation } from '../medication-administration/entities/medication-reconciliation.entity';
import { MissedDose } from '../medication-administration/entities/missed-dose.entity';
import { PatientVital } from '../healthcare-monitoring/entities/patient-vital.entity';
import { ClinicalAlert } from '../healthcare-monitoring/entities/clinical-alert.entity';
import { HealthcareIncident } from '../healthcare-monitoring/entities/healthcare-incident.entity';
import { Diagnosis } from '../diagnosis/entities/diagnosis.entity';
import { TreatmentPlan } from '../treatment-planning/entities/treatment-plan.entity';
import { MedicalProcedure } from '../treatment-planning/entities/medical-procedure.entity';
import { TreatmentOutcome } from '../treatment-planning/entities/treatment-outcome.entity';
import { CriticalCareMonitoring } from '../emergency-operations/entities/critical-care-monitoring.entity';
import { InfectionCase } from '../infection-control/entities/infection-case.entity';
import { IsolationPrecaution } from '../infection-control/entities/isolation-precaution.entity';
import { AntibioticResistance } from '../infection-control/entities/antibiotic-resistance.entity';
import { PathologyCase } from '../pathology/entities/pathology-case.entity';
import { ProviderPatientRelationship } from '../provider-patient/entities/provider-patient-relationship.entity';
import { CareplanHandoff } from '../provider-patient/entities/care-plan-handoff.entity';
import { PatientTransfer } from '../hospital-registry/entities/patient-transfer.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      GdprRequest,
      User,
      Patient,
      Record,
      MedicalRecord,
      AccessGrant,
      AuditLogEntity,
      GdprComplianceLog,
      BillingEntity,
      InsuranceClaim,
      Insurance,
      Payment,
      MedicationAdministrationRecord,
      MedicationOrder,
      AdverseDrugReaction,
      MedicationReconciliation,
      MissedDose,
      PatientVital,
      ClinicalAlert,
      HealthcareIncident,
      Diagnosis,
      TreatmentPlan,
      MedicalProcedure,
      TreatmentOutcome,
      CriticalCareMonitoring,
      InfectionCase,
      IsolationPrecaution,
      AntibioticResistance,
      PathologyCase,
      ProviderPatientRelationship,
      CareplanHandoff,
      PatientTransfer,
    ]),
    BullModule.registerQueue({
      name: 'gdpr',
    }),
    AuthModule,
    PatientModule,
    RecordsModule,
    MedicalRecordsModule,
    AccessControlModule,
    NotificationsModule,
    StellarModule,
    DataRetentionModule,
  ],
  controllers: [GdprController],
  providers: [GdprService, GdprProcessor, DeletionRegistryService],
  exports: [GdprService, DeletionRegistryService],
})
export class GdprModule {}
