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

@Injectable()
export class ReconciliationService {
  constructor(
    @InjectRepository(MedicationReconciliation)
    private reconciliationRepository: Repository<MedicationReconciliation>,
    private alertService: AlertService,
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
    await this.reconciliationRepository.update(id, {
      allergiesReviewed: true,
    });

    return await this.findOne(id);
  }

  async checkDrugInteractions(id: string, interactions?: any[]): Promise<MedicationReconciliation> {
    const reconciliation = await this.findOne(id);

    await this.reconciliationRepository.update(id, {
      drugInteractionsChecked: true,
    });

    // Send alert if interactions found
    if (interactions && interactions.length > 0) {
      await this.alertService.sendDrugInteractionAlert(reconciliation.patientId, interactions);
    }

    return await this.findOne(id);
  }

  async checkDuplicateTherapy(id: string): Promise<MedicationReconciliation> {
    await this.reconciliationRepository.update(id, {
      duplicateTherapyChecked: true,
    });

    return await this.findOne(id);
  }

  async checkRenalDosing(id: string): Promise<MedicationReconciliation> {
    await this.reconciliationRepository.update(id, {
      renalDosingChecked: true,
    });

    return await this.findOne(id);
  }

  async checkHepaticDosing(id: string): Promise<MedicationReconciliation> {
    await this.reconciliationRepository.update(id, {
      hepaticDosingChecked: true,
    });

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

        // Check for frequency differences
        if (homeMed.frequency !== currentMed.frequency) {
          discrepancies.push({
            type: 'FREQUENCY_DIFFERENCE',
            medication: homeMed,
            currentMedication: currentMed,
            description: `Frequency difference for ${homeMed.name}: home ${homeMed.frequency} vs current ${currentMed.frequency}`,
          });
        }
      }
    });

    // Check for new medications in current list
    currentMedications.forEach((currentMed) => {
      const homeMed = homeMedications.find(
        (home) => home.name.toLowerCase() === currentMed.name.toLowerCase(),
      );

      if (!homeMed) {
        discrepancies.push({
          type: 'NEW_MEDICATION',
          medication: currentMed,
          description: `${currentMed.name} is a new medication not in home medications`,
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
    const reconciled = [];

    // Start with current medications as base
    currentMedications.forEach((currentMed) => {
      reconciled.push({
        ...currentMed,
        action: 'CONTINUE',
        source: 'CURRENT',
      });
    });

    // Add home medications that are missing from current
    homeMedications.forEach((homeMed) => {
      const existsInCurrent = currentMedications.find(
        (curr) => curr.name.toLowerCase() === homeMed.name.toLowerCase(),
      );

      if (!existsInCurrent) {
        reconciled.push({
          ...homeMed,
          action: 'ADD',
          source: 'HOME',
        });
      }
    });

    return reconciled;
  }

  async getReconciliationStats(startDate: string, endDate: string) {
    const reconciliations = await this.reconciliationRepository.find({
      where: {
        createdAt: Between(new Date(startDate), new Date(endDate)),
      },
    });

    const stats = {
      total: reconciliations.length,
      completed: reconciliations.filter((r) => r.status === ReconciliationStatus.COMPLETED).length,
      pending: reconciliations.filter((r) => r.status === ReconciliationStatus.PENDING).length,
      inProgress: reconciliations.filter((r) => r.status === ReconciliationStatus.IN_PROGRESS)
        .length,
      requiresReview: reconciliations.filter(
        (r) => r.status === ReconciliationStatus.REQUIRES_REVIEW,
      ).length,
      withDiscrepancies: reconciliations.filter(
        (r) => r.discrepanciesFound && r.discrepanciesFound.length > 0,
      ).length,
      typeBreakdown: {} as Record<string, number>,
      averageDiscrepancies: 0,
    };

    // Calculate type breakdown
    reconciliations.forEach((r) => {
      stats.typeBreakdown[r.reconciliationType] =
        (stats.typeBreakdown[r.reconciliationType] || 0) + 1;
    });

    // Calculate average discrepancies
    const totalDiscrepancies = reconciliations.reduce((sum, r) => {
      return sum + (r.discrepanciesFound ? r.discrepanciesFound.length : 0);
    }, 0);
    stats.averageDiscrepancies =
      reconciliations.length > 0 ? totalDiscrepancies / reconciliations.length : 0;

    return stats;
  }
}
