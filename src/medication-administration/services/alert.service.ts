import { Injectable, Logger } from '@nestjs/common';
import { MedicationAdministrationRecord } from '../entities/medication-administration-record.entity';
import { MissedDose } from '../entities/missed-dose.entity';
import { AdverseDrugReaction } from '../entities/adverse-drug-reaction.entity';

@Injectable()
export class AlertService {
  private readonly logger = new Logger(AlertService.name);

  async sendHighAlertRefusalAlert(mar: MedicationAdministrationRecord): Promise<void> {
    this.logger.warn(
      `HIGH ALERT: Patient ${mar.patientId} refused high-alert medication ${mar.medicationName}`,
    );

    // In a real implementation, this would:
    // - Send notifications to charge nurse
    // - Alert physician
    // - Create incident report
    // - Send to pharmacy for review

    const alertData = {
      type: 'HIGH_ALERT_REFUSAL',
      patientId: mar.patientId,
      medicationName: mar.medicationName,
      scheduledTime: mar.scheduledTime,
      nurseId: mar.nurseId,
      timestamp: new Date(),
    };

    await this.sendAlert(alertData);
  }

  async sendCriticalMissedDoseAlert(missedDose: MissedDose): Promise<void> {
    this.logger.warn(
      `CRITICAL MISSED DOSE: Patient ${missedDose.patientId} missed critical medication ${missedDose.medicationName}`,
    );

    const alertData = {
      type: 'CRITICAL_MISSED_DOSE',
      patientId: missedDose.patientId,
      medicationName: missedDose.medicationName,
      scheduledTime: missedDose.scheduledTime,
      reason: missedDose.reason,
      nurseId: missedDose.nurseId,
      timestamp: new Date(),
    };

    await this.sendAlert(alertData);
  }

  async sendSevereAdverseReactionAlert(adr: AdverseDrugReaction): Promise<void> {
    this.logger.error(
      `SEVERE ADVERSE REACTION: Patient ${adr.patientId} had ${adr.severity} reaction to ${adr.medicationName}`,
    );

    const alertData = {
      type: 'SEVERE_ADVERSE_REACTION',
      patientId: adr.patientId,
      medicationName: adr.medicationName,
      severity: adr.severity,
      symptoms: adr.symptoms,
      reporterId: adr.reporterId,
      timestamp: new Date(),
    };

    await this.sendAlert(alertData);
  }

  async sendPhysicianMissedDoseNotification(missedDose: MissedDose): Promise<void> {
    this.logger.log(`Notifying physician about missed dose for patient ${missedDose.patientId}`);

    const notificationData = {
      type: 'PHYSICIAN_MISSED_DOSE_NOTIFICATION',
      patientId: missedDose.patientId,
      medicationName: missedDose.medicationName,
      scheduledTime: missedDose.scheduledTime,
      reason: missedDose.reason,
      reasonDetails: missedDose.reasonDetails,
      isCritical: missedDose.isCriticalMedication,
      timestamp: new Date(),
    };

    await this.sendNotification(notificationData);
  }

  async sendPhysicianAdverseReactionNotification(adr: AdverseDrugReaction): Promise<void> {
    this.logger.log(`Notifying physician about adverse reaction for patient ${adr.patientId}`);

    const notificationData = {
      type: 'PHYSICIAN_ADR_NOTIFICATION',
      patientId: adr.patientId,
      medicationName: adr.medicationName,
      severity: adr.severity,
      symptoms: adr.symptoms,
      reactionType: adr.reactionType,
      reporterId: adr.reporterId,
      timestamp: new Date(),
    };

    await this.sendNotification(notificationData);
  }

  async sendPharmacyAdverseReactionNotification(adr: AdverseDrugReaction): Promise<void> {
    this.logger.log(`Notifying pharmacy about adverse reaction for patient ${adr.patientId}`);

    const notificationData = {
      type: 'PHARMACY_ADR_NOTIFICATION',
      patientId: adr.patientId,
      medicationName: adr.medicationName,
      severity: adr.severity,
      symptoms: adr.symptoms,
      reactionType: adr.reactionType,
      timestamp: new Date(),
    };

    await this.sendNotification(notificationData);
  }

  async sendMedicationDueAlert(medications: MedicationAdministrationRecord[]): Promise<void> {
    if (medications.length === 0) return;

    this.logger.log(`${medications.length} medications due for administration`);

    const alertData = {
      type: 'MEDICATIONS_DUE',
      count: medications.length,
      medications: medications.map((med) => ({
        id: med.id,
        patientId: med.patientId,
        medicationName: med.medicationName,
        scheduledTime: med.scheduledTime,
        isHighAlert: med.isHighAlert,
      })),
      timestamp: new Date(),
    };

    await this.sendAlert(alertData);
  }

  async sendOverdueMedicationAlert(medications: MedicationAdministrationRecord[]): Promise<void> {
    if (medications.length === 0) return;

    this.logger.warn(`${medications.length} medications are overdue`);

    const alertData = {
      type: 'MEDICATIONS_OVERDUE',
      count: medications.length,
      medications: medications.map((med) => ({
        id: med.id,
        patientId: med.patientId,
        medicationName: med.medicationName,
        scheduledTime: med.scheduledTime,
        isHighAlert: med.isHighAlert,
        minutesOverdue: Math.floor(
          (new Date().getTime() - med.scheduledTime.getTime()) / (1000 * 60),
        ),
      })),
      timestamp: new Date(),
    };

    await this.sendAlert(alertData);
  }

  async sendBarcodeVerificationFailureAlert(
    marId: string,
    verificationType: string,
    error: string,
  ): Promise<void> {
    this.logger.warn(`Barcode verification failed for MAR ${marId}: ${error}`);

    const alertData = {
      type: 'BARCODE_VERIFICATION_FAILURE',
      marId,
      verificationType,
      error,
      timestamp: new Date(),
    };

    await this.sendAlert(alertData);
  }

  private async sendAlert(alertData: any): Promise<void> {
    // In a real implementation, this would:
    // - Send to notification service
    // - Create database record
    // - Send push notifications
    // - Send emails
    // - Integrate with hospital communication systems

    this.logger.log(`ALERT SENT: ${JSON.stringify(alertData)}`);

    // Simulate async notification sending
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  private async sendNotification(notificationData: any): Promise<void> {
    // In a real implementation, this would:
    // - Send to specific recipients
    // - Use different channels based on urgency
    // - Track delivery status
    // - Handle escalation if not acknowledged

    this.logger.log(`NOTIFICATION SENT: ${JSON.stringify(notificationData)}`);

    // Simulate async notification sending
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  async sendReconciliationAlert(patientId: string, discrepancyCount: number): Promise<void> {
    this.logger.warn(
      `Medication reconciliation found ${discrepancyCount} discrepancies for patient ${patientId}`,
    );

    const alertData = {
      type: 'RECONCILIATION_DISCREPANCIES',
      patientId,
      discrepancyCount,
      timestamp: new Date(),
    };

    await this.sendAlert(alertData);
  }

  async sendDrugInteractionAlert(patientId: string, interactions: any[]): Promise<void> {
    this.logger.warn(`Drug interactions detected for patient ${patientId}`);

    const alertData = {
      type: 'DRUG_INTERACTIONS',
      patientId,
      interactionCount: interactions.length,
      interactions,
      timestamp: new Date(),
    };

    await this.sendAlert(alertData);
  }
}
