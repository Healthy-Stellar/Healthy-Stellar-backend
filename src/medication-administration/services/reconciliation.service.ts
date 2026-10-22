import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import {
  MedicationReconciliation,
  ReconciliationType,
  ReconciliationStatus,
} from '../entities/medication-reconciliation.entity';
import { CreateReconciliationDto } from '../dto/create-reconciliation.dto';
import { AlertService } from './alert.service';
import { DrugInteractionService } from '../../pharmacy/services/drug-interaction.service';
import { SafetyAlertService } from '../../pharmacy/services/safety-alert.service';

@Injectable()
export class ReconciliationService {
  constructor(
    @InjectRepository(MedicationReconciliation)
    private reconciliationRepository: Repository<MedicationReconciliation>,
    private alertService: AlertService,
    private drugInteractionService: DrugInteractionService,
    private safetyAlertService: SafetyAlertService,
  ) {}

  async create(
    createReconciliationDto: CreateReconciliationDto,
  ): Promise<MedicationReconciliation> {
    const reconciliation = this.reconciliationRepository.create(createReconciliationDto);
    return await this.reconciliationRepository.save(reconciliation);
  }

  async findAll(): Promise<MedicationReconciliation[]> {
    return await this.reconciliationRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findByPatient(patientId: string): Promise<MedicationReconciliation[]> {
    return await this.reconciliationRepository.find({
      where: { patientId },
      order: { createdAt: 'DESC' },
    });
  }

  async findPending(): Promise<MedicationReconciliation[]> {
    return await this.reconciliationRepository.find({
      where: { status: ReconciliationStatus.PENDING },
      order: { createdAt: 'ASC' },
    });
  }

  async findByType(type: ReconciliationType): Promise<MedicationReconciliation[]> {
    return await this.reconciliationRepository.find({
      where: { reconciliationType: type },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<MedicationReconciliation> {
    const reconciliation = await this.reconciliationRepository.findOne({
      where: { id },
    });

    if (!reconciliation) {
      throw new NotFoundException('Medication reconciliation not found');
    }

    return reconciliation;
  }

  async updateStatus(id: string, status: ReconciliationStatus): Promise<MedicationReconciliation> {
    const reconciliation = await this.findOne(id);

    const updates: Partial<MedicationReconciliation> = { status };

    if (status === ReconciliationStatus.COMPLETED) {
      updates.completedAt = new Date();
    }

    await this.reconciliationRepository.update(id, updates);
    return await this.findOne(id);
  }

  async addHomeMedications(id: string, medications: any[]): Promise<MedicationReconciliation> {
    const reconciliation = await this.findOne(id);

    await this.reconciliationRepository.update(id, {
      homeMedications: medications,
      status: ReconciliationStatus.IN_PROGRESS,
    });

    return await this.findOne(id);
  }

  async addCurrentMedications(id: string, medications: any[]): Promise<MedicationReconciliation> {
    const reconciliation = await this.findOne(id);

    await this.reconciliationRepository.update(id, {
      currentMedications: medications,
      status: ReconciliationStatus.IN_PROGRESS,
    });

    return await this.findOne(id);
  }

  async performReconciliation(
    id: string,
    pharmacistId: string,
    pharmacistName: string,
  ): Promise<MedicationReconciliation> {
    const reconciliation = await this.findOne(id);

    if (!reconciliation.homeMedications || !reconciliation.currentMedications) {
      throw new Error('Both home and current medications must be provided before reconciliation');
    }

    const discrepancies = this.findDiscrepancies(
      reconciliation.homeMedications,
      reconciliation.currentMedications,
    );

    const reconciledMedications = this.createReconciledList(
      reconciliation.homeMedications,
      reconciliation.currentMedications,
      discrepancies,
    );

    const updates: Partial<MedicationReconciliation> = {
      pharmacistId,
      pharmacistName,
      discrepanciesFound: discrepancies,
      reconciledMedications,
      status:
        discrepancies.length > 0
          ? ReconciliationStatus.REQUIRES_REVIEW
          : ReconciliationStatus.COMPLETED,
      completedAt: discrepancies.length === 0 ? new Date() : null,
    };

    await this.reconciliationRepository.update(id, updates);

    // Send alert if discrepancies found
    if (discrepancies.length > 0) {
      await this.alertService.sendReconciliationAlert(
        reconciliation.patientId,
        discrepancies.length,
      );
    }

    return await this.findOne(id);
  }

  async reviewDiscrepancies(
    id: string,
    reviewerId: string,
    actions: any[],
    notes?: string,
  ): Promise<MedicationReconciliation> {
    const reconciliation = await this.findOne(id);

    await this.reconciliationRepository.update(id, {
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
      actionsTaken: actions,
      reconciliationNotes: notes,
      status: ReconciliationStatus.COMPLETED,
      completedAt: new Date(),
    });

    return await this.findOne(id);
  }

  async checkAllergies(id: string): Promise<MedicationReconciliation> {
    const reconciliation = await this.findOne(id);
    const medications = this.getActiveMedications(reconciliation);

    const findings: any[] = [];
    for (const medication of medications) {
      const alerts = await this.safetyAlertService.checkAllergies(
        reconciliation.patientId,
        medication,
      );
      if (alerts && alerts.length > 0) {
        findings.push(...alerts);
      }
    }

    await this.reconciliationRepository.update(id, {
      allergiesReviewed: true,
      allergyFindings: findings,
    });

    if (findings.length > 0) {
      await this.alertService.sendDrugInteractionAlert(reconciliation.patientId, findings);
    }

    return await this.findOne(id);
  }

  async checkDrugInteractions(id: string, interactions?: any[]): Promise<MedicationReconciliation> {
    const reconciliation = await this.findOne(id);
    const medications = this.getActiveMedications(reconciliation);

    let findings: any[] = interactions ?? [];
    if (!interactions) {
      findings = await this.drugInteractionService.checkInteractions(medications);
    }

    await this.reconciliationRepository.update(id, {
      drugInteractionsChecked: true,
      drugInteractionFindings: findings,
    });

    // Send alert if interactions found
    if (findings && findings.length > 0) {
      await this.alertService.sendDrugInteractionAlert(reconciliation.patientId, findings);
    }

    return await this.findOne(id);
  }

  async checkDuplicateTherapy(id: string): Promise<MedicationReconciliation> {
    const reconciliation = await this.findOne(id);
    const medications = this.getActiveMedications(reconciliation);

    const findings = await this.drugInteractionService.checkDuplicateTherapy(medications);

    await this.reconciliationRepository.update(id, {
      duplicateTherapyChecked: true,
      duplicateTherapyFindings: findings,
    });

    if (findings && findings.length > 0) {
      await this.alertService.sendDrugInteractionAlert(reconciliation.patientId, findings);
    }

    return await this.findOne(id);
  }

  async checkRenalDosing(id: string): Promise<MedicationReconciliation> {
    const reconciliation = await this.findOne(id);
    const medications = this.getActiveMedications(reconciliation);

    const renalFunction = this.getRenalFunction(reconciliation);
    const findings: any[] = [];

    if (renalFunction !== null) {
      for (const medication of medications) {
        const threshold = this.getRenalDosingThreshold(medication);
        if (threshold !== null && renalFunction < threshold) {
          findings.push({
            type: 'RENAL_DOSING',
            medication: medication.name,
            renalFunction,
            threshold,
            description: `${medication.name} may require renal dose adjustment (renal function ${renalFunction} below threshold ${threshold})`,
          });
        }
      }
    }

    await this.reconciliationRepository.update(id, {
      renalDosingChecked: true,
      renalDosingFindings: findings,
    });

    if (findings.length > 0) {
      await this.alertService.sendDrugInteractionAlert(reconciliation.patientId, findings);
    }

    return await this.findOne(id);
  }

  async checkHepaticDosing(id: string): Promise<MedicationReconciliation> {
    const reconciliation = await this.findOne(id);
    const medications = this.getActiveMedications(reconciliation);

    const hepaticFunction = this.getHepaticFunction(reconciliation);
    const findings: any[] = [];

    if (hepaticFunction !== null) {
      for (const medication of medications) {
        const threshold = this.getHepaticDosingThreshold(medication);
        if (threshold !== null && hepaticFunction < threshold) {
          findings.push({
            type: 'HEPATIC_DOSING',
            medication: medication.name,
            hepaticFunction,
            threshold,
            description: `${medication.name} may require hepatic dose adjustment (hepatic function ${hepaticFunction} below threshold ${threshold})`,
          });
        }
      }
    }

    await this.reconciliationRepository.update(id, {
      hepaticDosingChecked: true,
      hepaticDosingFindings: findings,
    });

    if (findings.length > 0) {
      await this.alertService.sendDrugInteractionAlert(reconciliation.patientId, findings);
    }

    return await this.findOne(id);
  }

  async completePatientInterview(id: string): Promise<MedicationReconciliation> {
    await this.reconciliationRepository.update(id, {
      patientInterviewCompleted: true,
    });

    return await this.findOne(id);
  }

  async provideMedicationList(id: string): Promise<MedicationReconciliation> {
    await this.reconciliationRepository.update(id, {
      medicationListProvided: true,
    });

    return await this.findOne(id);
  }

  async completePatientEducation(id: string): Promise<MedicationReconciliation> {
    await this.reconciliationRepository.update(id, {
      patientEducationCompleted: true,
    });

    return await this.findOne(id);
  }

  private getActiveMedications(reconciliation: MedicationReconciliation): any[] {
    const current = reconciliation.currentMedications ?? [];
    const reconciled = reconciliation.reconciledMedications ?? [];
    const combined = [...current, ...reconciled];

    const seen = new Set<string>();
    return combined.filter((medication) => {
      if (!medication || !medication.name) {
        return false;
      }
      if (medication.active === false || medication.status === 'DISCONTINUED') {
        return false;
      }
      const key = medication.name.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  private getRenalFunction(reconciliation: MedicationReconciliation): number | null {
    const value =
      reconciliation.renalFunction ??
      reconciliation.egfr ??
      reconciliation.creatinineClearance ??
      null;
    return typeof value === 'number' ? value : null;
  }

  private getHepaticFunction(reconciliation: MedicationReconciliation): number | null {
    const value = reconciliation.hepaticFunction ?? reconciliation.childPughScore ?? null;
    return typeof value === 'number' ? value : null;
  }

  private getRenalDosingThreshold(medication: any): number | null {
    const threshold = medication.renalThreshold ?? medication.minRenalFunction ?? null;
    return typeof threshold === 'number' ? threshold : null;
  }

  private getHepaticDosingThreshold(medication: any): number | null {
    const threshold = medication.hepaticThreshold ?? medication.minHepaticFunction ?? null;
    return typeof threshold === 'number' ? threshold : null;
  }

  private findDiscrepancies(homeMedications: any[], currentMedications: any[]): any[] {
    const discrepancies = [];

    // Check for medications in home list but not in current list
    homeMedications.forEach((homeMed) => {
      const currentMed = currentMedications.find(
        (curr) => curr.name.toLowerCase() === homeMed.name.toLowerCase(),
      );

      if (!currentMed) {
        discrepancies.push({
          type: 'MISSING_FROM_CURRENT',
          medication: homeMed,
          description: `${homeMed.name} is in home medications but not in current medications`,
        });
      } else {
        // Check for dosage differences
        if (homeMed.dosage !== currentMed.dosage) {
          discrepancies.push({
            type: 'DOSAGE_DIFFERENCE',
            medication: homeMed,
            currentMedication: currentMed,
            description: `Dosage difference for ${homeMed.name}: home ${homeMed.dosage} vs current ${currentMed.dosage}`,
          });
        }
      }
    });

    // Check for medications in current list but not in home list
    currentMedications.forEach((currentMed) => {
      const homeMed = homeMedications.find(
        (home) => home.name.toLowerCase() === currentMed.name.toLowerCase(),
      );

      if (!homeMed) {
        discrepancies.push({
          type: 'MISSING_FROM_HOME',
          medication: currentMed,
          description: `${currentMed.name} is in current medications but not in home medications`,
        });
      }
    });

    return discrepancies;
  }

  private createReconciledList(
    homeMedications: any[],
    currentMedications: any[],
    discrepancies: any[],
  ): any[] {
    const reconciled = [...currentMedications];

    discrepancies.forEach((discrepancy) => {
      if (discrepancy.type === 'MISSING_FROM_CURRENT') {
        reconciled.push({
          ...discrepancy.medication,
          source: 'HOME',
          requiresReview: true,
        });
      }
    });

    return reconciled;
  }
}
