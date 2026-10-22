import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  RemotePrescription,
  PrescriptionStatus,
  MedicationClass,
} from '../entities/remote-prescription.entity';

export interface CreatePrescriptionDto {
  patientId: string;
  providerId: string;
  virtualVisitId?: string;
  medicationName: string;
  genericName?: string;
  strength: string;
  dosageForm: string;
  directions: string;
  quantity: number;
  quantityUnit: string;
  refills: number;
  daysSupply: number;
  medicationClass: MedicationClass;
  deaSchedule?: string;
  pharmacyId?: string;
  pharmacyName?: string;
  diagnosisCodes?: any[];
  clinicalReason?: string;
}

@Injectable()
export class RemotePrescriptionService {
  constructor(
    @InjectRepository(RemotePrescription)
    private prescriptionRepository: Repository<RemotePrescription>,
  ) {}

  async createPrescription(dto: CreatePrescriptionDto): Promise<RemotePrescription> {
    // Validate controlled substance requirements
    if (dto.medicationClass === MedicationClass.CONTROLLED_SUBSTANCE) {
      this.validateControlledSubstance(dto);
    }

    // Check for drug interactions and allergies
    const interactions = await this.checkDrugInteractions(dto.patientId, dto.medicationName);
    const allergies = await this.checkAllergies(dto.patientId, dto.medicationName);

    const prescriptionNumber = this.generatePrescriptionNumber();
    const prescribedDate = new Date();
    const expirationDate = new Date();
    expirationDate.setFullYear(expirationDate.getFullYear() + 1); // 1 year expiration

    const prescription = this.prescriptionRepository.create({
      ...dto,
      status: PrescriptionStatus.DRAFT,
      isControlledSubstance: dto.medicationClass === MedicationClass.CONTROLLED_SUBSTANCE,
      prescriptionNumber,
      prescribedDate,
      expirationDate,
      drugInteractions: interactions,
      hasInteractionWarning: interactions.length > 0,
      allergies,
      meetsEpcsRequirements: true,
      hipaaCompliant: true,
      auditTrail: [
        {
          action: 'CREATED',
          performedBy: dto.providerId,
          timestamp: new Date(),
        },
      ],
    });

    return this.prescriptionRepository.save(prescription);
  }

  async approvePrescription(
    prescriptionId: string,
    providerId: string,
  ): Promise<RemotePrescription> {
    const prescription = await this.findOne(prescriptionId);

    if (prescription.providerId !== providerId) {
      throw new BadRequestException('Only the prescribing provider can approve');
    }

    if (prescription.hasInteractionWarning && !prescription.overrideInteractionWarning) {
      throw new BadRequestException('Drug interaction warning must be reviewed and overridden');
    }

    prescription.status = PrescriptionStatus.APPROVED;
    this.addAuditEntry(prescription, 'APPROVED', providerId);

    return this.prescriptionRepository.save(prescription);
  }

  async sendToPharmacy(
    prescriptionId: string,
    providerId: string,
    electronicSignature: string,
  ): Promise<RemotePrescription> {
    const prescription = await this.findOne(prescriptionId);

    if (prescription.status !== PrescriptionStatus.APPROVED) {
      throw new BadRequestException('Prescription must be approved before sending to pharmacy');
    }

    if (!prescription.pharmacyId) {
      throw new BadRequestException('Pharmacy must be selected');
    }

    // Validate provider credentials
    const complianceChecks = this.validateProviderCompliance(prescription);
    prescription.complianceChecks = complianceChecks;

    if (!complianceChecks.stateLicenseValid || !complianceChecks.deaRegistrationValid) {
      throw new BadRequestException('Provider credentials are not valid');
    }

    prescription.status = PrescriptionStatus.SENT_TO_PHARMACY;
    prescription.isElectronicPrescription = true;
    prescription.electronicPrescriptionId = this.generateEPrescriptionId();
    prescription.sentToPharmacyAt = new Date();
    prescription.electronicSignature = electronicSignature;
    prescription.signedAt = new Date();

    this.addAuditEntry(prescription, 'SENT_TO_PHARMACY', providerId);

    // In production: Send to pharmacy via NCPDP SCRIPT standard
    // await this.ncpdpService.sendPrescription(prescription);

    return this.prescriptionRepository.save(prescription);
  }

  async markAsFilled(prescriptionId: string): Promise<RemotePrescription> {
    const prescription = await this.findOne(prescriptionId);

    prescription.status = PrescriptionStatus.FILLED;
    prescription.filledAt = new Date();

    this.addAuditEntry(prescription, 'FILLED', 'pharmacy');

    return this.prescriptionRepository.save(prescription);
  }

  async cancelPrescription(
    prescriptionId: string,
    cancelledBy: string,
    reason: string,
  ): Promise<RemotePrescription> {
    const prescription = await this.findOne(prescriptionId);

    if (prescription.status === PrescriptionStatus.FILLED) {
      throw new BadRequestException('Cannot cancel filled prescription');
    }

    prescription.status = PrescriptionStatus.CANCELLED;
    prescription.cancellationReason = reason;
    prescription.cancelledBy = cancelledBy;
    prescription.cancelledAt = new Date();

    this.addAuditEntry(prescription, 'CANCELLED', cancelledBy, { reason });

    return this.prescriptionRepository.save(prescription);
  }

  async overrideInteractionWarning(
    prescriptionId: string,
    providerId: string,
    reason: string,
  ): Promise<RemotePrescription> {
    const prescription = await this.findOne(prescriptionId);

    if (!prescription.hasInteractionWarning) {
      throw new BadRequestException('No interaction warning to override');
    }

    prescription.overrideInteractionWarning = true;
    prescription.overrideReason = reason;

    this.addAuditEntry(prescription, 'INTERACTION_OVERRIDE', providerId, {
      reason,
    });

    return this.prescriptionRepository.save(prescription);
  }

  async getPatientPrescriptions(
    patientId: string,
    activeOnly = false,
  ): Promise<RemotePrescription[]> {
    const whereClause: any = { patientId, deletedAt: null };

    if (activeOnly) {
      whereClause.status = PrescriptionStatus.SENT_TO_PHARMACY;
    }

    return this.prescriptionRepository.find({
      where: whereClause,
      order: { prescribedDate: 'DESC' },
    });
  }

  async getPrescriptionHistory(
    patientId: string,
    medicationName: string,
  ): Promise<RemotePrescription[]> {
    return this.prescriptionRepository.find({
      where: {
        patientId,
        medicationName,
        deletedAt: null,
      },
      order: { prescribedDate: 'DESC' },
    });
  }

  async checkMedicationAdherence(patientId: string, days = 30): Promise<any> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const prescriptions = await this.prescriptionRepository.find({
      where: {
        patientId,
        status: PrescriptionStatus.FILLED,
        filledAt: MoreThan(startDate),
      },
    });

    const totalPrescriptions = prescriptions.length;
    const refillsCompleted = prescriptions.filter((p) => p.refills > 0).length;

    return {
      patientId,
      period: `${days} days`,
      totalPrescriptions,
      filledPrescriptions: totalPrescriptions,
      adherenceRate: 100, // Simplified - in production, track actual adherence
      refillsCompleted,
      upcomingRefills: this.calculateUpcomingRefills(prescriptions),
    };
  }

  async requestPriorAuthorization(
    prescriptionId: string,
    authorizationDetails: any,
  ): Promise<RemotePrescription> {
    const prescription = await this.findOne(prescriptionId);

    prescription.isPriorAuthorizationRequired = true;
    prescription.priorAuthorizationNumber = authorizationDetails.authNumber;
    prescription.priorAuthorizationObtained = authorizationDetails.obtained;

    this.addAuditEntry(
      prescription,
      'PRIOR_AUTH_REQUESTED',
      prescription.providerId,
      authorizationDetails,
    );

    return this.prescriptionRepository.save(prescription);
  }

  private async checkDrugInteractions(patientId: string, newMedication: string): Promise<any[]> {
    // Get active medications
    const activeMeds = await this.getPatientPrescriptions(patientId, true);

    const interactions: any[] = [];

    // In production: Use drug interaction database/API
    // This is a simplified example
    const knownInteractions = {
      warfarin: ['aspirin', 'ibuprofen'],
      metformin: ['alcohol'],
      lisinopril: ['potassium'],
    };

    activeMeds.forEach((med) => {
      if (
        knownInteractions[newMedication.toLowerCase()]?.includes(med.medicationName.toLowerCase())
      ) {
        interactions.push({
          interactingMedication: med.medicationName,
          severity: 'moderate',
          description: `Potential interaction between ${newMedication} and ${med.medicationName}`,
        });
      }
    });

    return interactions;
  }

  private async checkAllergies(patientId: string, medicationName: string): Promise<any[]> {
    // In production: Query patient allergy records
    // This is a simplified example
    return [];
  }

  private validateControlledSubstance(dto: CreatePrescriptionDto): void {
    if (!dto.deaSchedule) {
      throw new BadRequestException('DEA schedule required for controlled substances');
    }

    // Schedule II has more restrictions
    if (dto.deaSchedule === 'II' && dto.refills > 0) {
      throw new BadRequestException('Schedule II controlled substances cannot have refills');
    }

    // Schedule III-V limited to 5 refills
    if (['III', 'IV', 'V'].includes(dto.deaSchedule) && dto.refills > 5) {
      throw new BadRequestException('Maximum 5 refills allowed for Schedule III-V');
    }
  }

  private validateProviderCompliance(prescription: RemotePrescription): any {
    // In production: Verify against provider credential database
    return {
      stateLicenseValid: true,
      deaRegistrationValid: prescription.isControlledSubstance ? true : null,
      patientConsentObtained: true,
      appropriateDocumentation: true,
    };
  }

  private generatePrescriptionNumber(): string {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    return `RX-${timestamp}-${random}`;
  }

  private generateEPrescriptionId(): string {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    return `ERXBATCH-${timestamp}-${random}`;
  }

  private calculateUpcomingRefills(prescriptions: RemotePrescription[]): any[] {
    return prescriptions
      .filter((p) => p.refills > 0)
      .map((p) => {
        const daysUntilRefill =
          p.daysSupply -
          Math.floor((new Date().getTime() - p.filledAt.getTime()) / (1000 * 60 * 60 * 24));

        return {
          medicationName: p.medicationName,
          daysUntilRefill: Math.max(0, daysUntilRefill),
          refillsRemaining: p.refills,
        };
      });
  }

  private addAuditEntry(
    prescription: RemotePrescription,
    action: string,
    performedBy: string,
    details?: any,
  ): void {
    const auditTrail = prescription.auditTrail || [];
    auditTrail.push({
      action,
      performedBy,
      timestamp: new Date(),
      details,
    });
    prescription.auditTrail = auditTrail;
  }

  async findOne(id: string): Promise<RemotePrescription> {
    const prescription = await this.prescriptionRepository.findOne({
      where: { id, deletedAt: null },
    });

    if (!prescription) {
      throw new NotFoundException(`Prescription with ID ${id} not found`);
    }

    return prescription;
  }
}

// Import for MoreThan
import { MoreThan } from 'typeorm';
