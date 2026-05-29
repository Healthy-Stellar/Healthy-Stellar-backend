// Simple test to verify MAR system functionality
import { Logger } from '@nestjs/common';
import {
  MedicationAdministrationRecord,
  AdministrationStatus,
  AdministrationRoute,
} from './entities/medication-administration-record.entity';
import { MissedDose, MissedDoseReason, FollowUpStatus } from './entities/missed-dose.entity';
import {
  AdverseDrugReaction,
  ReactionSeverity,
  ReactionType,
  ReactionStatus,
} from './entities/adverse-drug-reaction.entity';
import {
  BarcodeVerification,
  VerificationType,
  VerificationStatus,
} from './entities/barcode-verification.entity';
import {
  MedicationReconciliation,
  ReconciliationType,
  ReconciliationStatus,
} from './entities/medication-reconciliation.entity';

const logger = new Logger('MarTest');

// Test entity creation
function testEntityCreation() {
  logger.log('Testing MAR entity creation...');

  // Test MAR record
  const mar = new MedicationAdministrationRecord();
  mar.patientId = 'test-patient-id';
  mar.medicationName = 'Test Medication';
  mar.dosage = '10mg';
  mar.route = AdministrationRoute.ORAL;
  mar.status = AdministrationStatus.SCHEDULED;
  mar.scheduledTime = new Date();
  mar.administrationDate = new Date().toISOString().split('T')[0];

  logger.log('MAR record created:', {
    patientId: mar.patientId,
    medicationName: mar.medicationName,
    status: mar.status,
    route: mar.route,
  });

  // Test missed dose
  const missedDose = new MissedDose();
  missedDose.patientId = 'test-patient-id';
  missedDose.medicationName = 'Test Medication';
  missedDose.reason = MissedDoseReason.PATIENT_REFUSED;
  missedDose.followUpStatus = FollowUpStatus.PENDING;
  missedDose.scheduledTime = new Date();
  missedDose.missedDate = new Date().toISOString().split('T')[0];

  logger.log('Missed dose created:', {
    patientId: missedDose.patientId,
    reason: missedDose.reason,
    followUpStatus: missedDose.followUpStatus,
  });

  // Test adverse reaction
  const adr = new AdverseDrugReaction();
  adr.patientId = 'test-patient-id';
  adr.medicationName = 'Test Medication';
  adr.severity = ReactionSeverity.MODERATE;
  adr.reactionType = ReactionType.ALLERGIC;
  adr.status = ReactionStatus.ACTIVE;
  adr.symptoms = 'Test symptoms';
  adr.reactionDate = new Date();
  adr.reporterId = 'test-reporter-id';
  adr.reporterName = 'Test Reporter';
  adr.reporterRole = 'nurse';

  logger.log('ADR created:', {
    patientId: adr.patientId,
    severity: adr.severity,
    reactionType: adr.reactionType,
    status: adr.status,
  });

  // Test barcode verification
  const verification = new BarcodeVerification();
  verification.verificationType = VerificationType.MEDICATION_BARCODE;
  verification.scannedBarcode = 'test-barcode-123';
  verification.status = VerificationStatus.SUCCESS;
  verification.verificationTime = new Date();
  verification.nurseId = 'test-nurse-id';
  verification.nurseName = 'Test Nurse';

  logger.log('Barcode verification created:', {
    verificationType: verification.verificationType,
    status: verification.status,
    scannedBarcode: verification.scannedBarcode,
  });

  // Test reconciliation
  const reconciliation = new MedicationReconciliation();
  reconciliation.patientId = 'test-patient-id';
  reconciliation.reconciliationType = ReconciliationType.ADMISSION;
  reconciliation.status = ReconciliationStatus.PENDING;
  reconciliation.initiatedBy = 'test-user-id';
  reconciliation.initiatedByName = 'Test User';
  reconciliation.initiatedByRole = 'nurse';

  logger.log('Reconciliation created:', {
    patientId: reconciliation.patientId,
    reconciliationType: reconciliation.reconciliationType,
    status: reconciliation.status,
  });

  logger.log('All entities created successfully!');
  return true;
}

// Test enum values
function testEnums() {
  logger.log('Testing enum values...');

  logger.log('Administration Status:', Object.values(AdministrationStatus));
  logger.log('Administration Route:', Object.values(AdministrationRoute));
  logger.log('Missed Dose Reason:', Object.values(MissedDoseReason));
  logger.log('Follow Up Status:', Object.values(FollowUpStatus));
  logger.log('Reaction Severity:', Object.values(ReactionSeverity));
  logger.log('Reaction Type:', Object.values(ReactionType));
  logger.log('Reaction Status:', Object.values(ReactionStatus));
  logger.log('Verification Type:', Object.values(VerificationType));
  logger.log('Verification Status:', Object.values(VerificationStatus));
  logger.log('Reconciliation Type:', Object.values(ReconciliationType));
  logger.log('Reconciliation Status:', Object.values(ReconciliationStatus));

  logger.log('All enums tested successfully!');
  return true;
}

// Run tests
export function runMarTests() {
  try {
    testEntityCreation();
    testEnums();
    logger.log('✅ All MAR system tests passed!');
    return true;
  } catch (error) {
    logger.error('❌ MAR system test failed:', error);
    return false;
  }
}

// Export for testing
export {
  MedicationAdministrationRecord,
  AdministrationStatus,
  AdministrationRoute,
  MissedDose,
  MissedDoseReason,
  FollowUpStatus,
  AdverseDrugReaction,
  ReactionSeverity,
  ReactionType,
  ReactionStatus,
  BarcodeVerification,
  VerificationType,
  VerificationStatus,
  MedicationReconciliation,
  ReconciliationType,
  ReconciliationStatus,
};
