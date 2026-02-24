import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { MedicalDataSanitizerService } from './medical-data-sanitizer.service';
import { MedicalDataValidationPipe } from './medical-data.validator.pipe';
import { MedicalCodeValidatorService } from './medical-code-validator.service';
import { EmergencyAlertValidator } from './emergency-alert-validator';
import { MedicalDataEncryptionService } from './medical-data-encryption.service';

import { HIPAACCompliantErrorHandler } from '../errors/hipaa-compliant-error-handler';
import { MedicalEmergencyErrorFilter } from '../errors/medical-emergency-error.filter';

import { AuditLogService } from '../audit/audit-log.service';
import { MedicalOperationAuditService } from '../audit/medical-operation-audit.service';
import { AuditLogEntity } from '../audit/audit-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLogEntity])],
  providers: [
    MedicalDataSanitizerService,
    MedicalDataValidationPipe,
    MedicalCodeValidatorService,
    EmergencyAlertValidator,
    MedicalDataEncryptionService,
    HIPAACCompliantErrorHandler,
    MedicalEmergencyErrorFilter,
    AuditLogService,
    MedicalOperationAuditService,
  ],
  exports: [
    MedicalDataSanitizerService,
    MedicalDataValidationPipe,
    MedicalCodeValidatorService,
    EmergencyAlertValidator,
    MedicalDataEncryptionService,
    HIPAACCompliantErrorHandler,
    MedicalEmergencyErrorFilter,
    AuditLogService,
    MedicalOperationAuditService,
  ],
})
export class ValidationModule {}
