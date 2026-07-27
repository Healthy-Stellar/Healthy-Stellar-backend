import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';

// Entities
import {
  MedicalCodeRegistry,
  DataQualityReport,
  ClinicalAlertEntity,
  GovernancePolicyEntity,
  GovernanceComplianceLog,
  ReferenceDataUpdateLog,
} from './entities/medical-validation.entities';
import { TenantFieldValidationRule } from './entities/tenant-field-validation-rule.entity';

// Services
import { Icd10ValidationService } from './services/icd10-validation.service';
import { CptValidationService } from './services/cpt-validation.service';
import { LoincValidationService } from './services/loinc-validation.service';
import { ClinicalDataQualityService } from './services/clinical-data-quality.service';
import { ClinicalDecisionSupportService } from './services/clinical-decision-support.service';
import { ReferenceDataService } from './services/reference-data.service';
import { DataGovernanceService } from './services/data-governance.service';
import { MedicalMonitoringService } from '../medical-monitoring/medical-monitoring.service';
import { TenantFieldValidationService } from './services/tenant-field-validation.service';

// Controller
import { MedicalValidationController } from './medical-validation.controller';
import { TenantFieldValidationController } from './controllers/tenant-field-validation.controller';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([
      MedicalCodeRegistry,
      DataQualityReport,
      ClinicalAlertEntity,
      GovernancePolicyEntity,
      GovernanceComplianceLog,
      ReferenceDataUpdateLog,
      TenantFieldValidationRule,
    ]),
  ],
  controllers: [MedicalValidationController, TenantFieldValidationController],
  providers: [
    Icd10ValidationService,
    CptValidationService,
    LoincValidationService,
    ClinicalDataQualityService,
    ClinicalDecisionSupportService,
    ReferenceDataService,
    DataGovernanceService,
    MedicalMonitoringService,
    TenantFieldValidationService,
  ],
  exports: [
    Icd10ValidationService,
    CptValidationService,
    LoincValidationService,
    ClinicalDataQualityService,
    ClinicalDecisionSupportService,
    ReferenceDataService,
    DataGovernanceService,
    MedicalMonitoringService,
    TenantFieldValidationService,
  ],
})
export class MedicalValidationModule {}
