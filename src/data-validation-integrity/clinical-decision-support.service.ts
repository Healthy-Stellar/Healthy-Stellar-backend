import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { ClinicalAlertEntity } from '../entities/medical-validation.entities';
import { ClinicalAlert } from '../interfaces/validation-result.interface';
import { AlertSeverity } from '../medical-codes.constants';

interface DrugInteractionCheck {
  medicationCodes: string[]; // NDC or RxNorm codes
  patientId: string;
}

interface CriticalValueCheck {
  loincCode: string;
  value: number;
  unit: string;
  patientId: string;
}

interface AllergyCheck {
  prescribedNdc: string;
  allergyList: string[]; // NDC or drug class codes
  patientId: string;
}

// Simplified drug interaction pairs (in production, use a proper drug DB like Multum or First Databank)
const KNOWN_DRUG_INTERACTIONS: Record<
  string,
  { codes: string[]; severity: AlertSeverity; message: string }
> = {
  warfarin_aspirin: {
    codes: ['0069-2855', '63323-052'], // example NDCs
    severity: AlertSeverity.HIGH,
    message: 'Concurrent use of warfarin and aspirin significantly increases bleeding risk.',
  },
};

@Injectable()
export class ClinicalDecisionSupportService {
  private readonly logger = new Logger(ClinicalDecisionSupportService.name);

  constructor(
    @InjectRepository(ClinicalAlertEntity)
    private readonly alertRepo: Repository<ClinicalAlertEntity>,
  ) {}

  /**
   * Check for drug-drug interactions
   */
  async checkDrugInteractions(check: DrugInteractionCheck): Promise<ClinicalAlert[]> {
    const alerts: ClinicalAlert[] = [];

    // In production, call a drug interaction API (e.g., RxNav, Multum)
    // This is a simplified local check
    for (const [interactionKey, interaction] of Object.entries(KNOWN_DRUG_INTERACTIONS)) {
      const matchCount = check.medicationCodes.filter((code) =>
        interaction.codes.includes(code),
      ).length;

      if (matchCount >= 2) {
        const alert = await this.createAndSaveAlert({
          alertType: 'DRUG_DRUG_INTERACTION',
          severity: interaction.severity,
          title: `Drug Interaction Detected: ${interactionKey.replace('_', ' + ')}`,
          message: interaction.message,
          patientId: check.patientId,
          affectedCodes: interaction.codes,
          recommendations: [
            'Review medication combination with prescriber.',
            'Consider therapeutic alternatives.',
            'If combination is necessary, monitor closely for adverse effects.',
          ],
          references: ['FDA Drug Interactions', 'Clinical Pharmacology Database'],
          requiresAcknowledgment: true,
          isActionable: true,
        });
        alerts.push(alert);
      }
    }

    return alerts;
  }

  /**
   * Check for critical lab values requiring immediate action
   */
  async checkCriticalValues(check: CriticalValueCheck): Promise<ClinicalAlert | null> {
    const criticalRanges: Record<
      string,
      { criticalLow?: number; criticalHigh?: number; unit: string; name: string }
    > = {
      '2823-3': { criticalLow: 2.5, criticalHigh: 6.5, unit: 'mEq/L', name: 'Potassium' },
      '2160-0': { criticalHigh: 10.0, unit: 'mg/dL', name: 'Creatinine' },
      '718-7': { criticalLow: 7.0, criticalHigh: 20.0, unit: 'g/dL', name: 'Hemoglobin' },
      '2339-0': { criticalLow: 40, criticalHigh: 500, unit: 'mg/dL', name: 'Glucose' },
      '6598-7': { criticalHigh: 30, unit: 'seconds', name: 'Prothrombin Time' },
      '3016-3': { criticalLow: 0.1, criticalHigh: 100, unit: 'mIU/L', name: 'TSH' },
    };

    const range = criticalRanges[check.loincCode];
    if (!range) return null;

    let isCritical = false;
    let direction = '';
    if (range.criticalLow !== undefined && check.value < range.criticalLow) {
      isCritical = true;
      direction = 'LOW';
    }
    if (range.criticalHigh !== undefined && check.value > range.criticalHigh) {
      isCritical = true;
      direction = 'HIGH';
    }

    if (!isCritical) return null;

    return this.createAndSaveAlert({
      alertType: 'CRITICAL_LAB_VALUE',
      severity: AlertSeverity.CRITICAL,
      title: `Critical ${range.name} Value: ${direction}`,
      message: `${range.name} value of ${check.value} ${check.unit} is critically ${direction}. Immediate clinical evaluation required.`,
      patientId: check.patientId,
      affectedCodes: [check.loincCode],
      recommendations: [
        'Notify ordering provider immediately.',
        'Assess patient clinical status.',
        'Document notification in patient record.',
        'Repeat test to confirm if appropriate.',
      ],
      references: ['Critical Values Policy', 'Joint Commission NPSG 02.03.01'],
      requiresAcknowledgment: true,
      isActionable: true,
    });
  }

  /**
   * Check for allergy contraindications
   */
  async checkAllergyContraindications(check: AllergyCheck): Promise<ClinicalAlert | null> {
    // In production, expand drug class mappings via RxNorm or similar
    const isContraindicated = check.allergyList.some((allergyCode) =>
      check.prescribedNdc.startsWith(allergyCode.substring(0, 5)),
    );

    if (!isContraindicated) return null;

    return this.createAndSaveAlert({
      alertType: 'ALLERGY_CONTRAINDICATION',
      severity: AlertSeverity.CRITICAL,
      title: 'Potential Allergy Contraindication',
      message: `Prescribed medication may be contraindicated based on documented patient allergies.`,
      patientId: check.patientId,
      affectedCodes: [check.prescribedNdc, ...check.allergyList],
      recommendations: [
        'Do NOT administer medication until allergy is verified.',
        'Contact prescribing provider for alternative.',
        'Document allergy assessment in patient chart.',
      ],
      references: ['Patient Allergy Record', 'Pharmacy Review'],
      requiresAcknowledgment: true,
      isActionable: true,
    });
  }

  /**
   * Generate preventive care reminders based on patient data
   */
  async generatePreventiveCareAlerts(
    patientId: string,
    patientData: {
      age: number;
      sex: string;
      lastMammogram?: Date;
      lastColonoscopy?: Date;
      lastInfluenzaVaccine?: Date;
      smokingStatus?: string;
    },
  ): Promise<ClinicalAlert[]> {
    const alerts: ClinicalAlert[] = [];
    const now = new Date();

    // Mammogram reminder (women 40+, every 1-2 years)
    if (patientData.sex === 'F' && patientData.age >= 40) {
      if (!patientData.lastMammogram) {
        alerts.push(
          await this.createAndSaveAlert({
            alertType: 'PREVENTIVE_CARE_DUE',
            severity: AlertSeverity.INFO,
            title: 'Mammogram Screening Due',
            message: 'Patient is due for mammogram screening per age-based guidelines.',
            patientId,
            recommendations: ['Order mammogram screening', 'Document in preventive care record'],
            references: ['USPSTF Breast Cancer Screening Guidelines'],
            requiresAcknowledgment: false,
            isActionable: true,
          }),
        );
      }
    }

    // Influenza vaccine reminder (annual)
    if (patientData.lastInfluenzaVaccine) {
      const monthsSince =
        (now.getTime() - new Date(patientData.lastInfluenzaVaccine).getTime()) /
        (1000 * 60 * 60 * 24 * 30);
      if (monthsSince > 12) {
        alerts.push(
          await this.createAndSaveAlert({
            alertType: 'PREVENTIVE_CARE_DUE',
            severity: AlertSeverity.INFO,
            title: 'Annual Influenza Vaccine Due',
            message: `Patient's last influenza vaccine was ${Math.floor(monthsSince)} months ago.`,
            patientId,
            recommendations: ['Administer influenza vaccine', 'Document immunization in registry'],
            references: ['CDC Immunization Schedule'],
            requiresAcknowledgment: false,
            isActionable: true,
          }),
        );
      }
    }

    return alerts;
  }

  async acknowledgeAlert(
    alertId: string,
    resolvedBy: string,
    overrideReason?: string,
  ): Promise<{ success: boolean; message: string }> {
    const alert = await this.alertRepo.findOne({ where: { alertId } });

    if (!alert) {
      return { success: false, message: 'Alert not found.' };
    }

    if (alert.isResolved) {
      return { success: false, message: 'Alert is already resolved.' };
    }

    await this.alertRepo.update(alertId, {
      isResolved: true,
      resolvedBy,
      resolvedAt: new Date(),
      overrideReason,
    });

    return { success: true, message: 'Alert acknowledged successfully.' };
  }

  async getPatientAlerts(
    patientId: string,
    includeResolved: boolean = false,
  ): Promise<ClinicalAlertEntity[]> {
    const query = this.alertRepo
      .createQueryBuilder('alert')
      .where('alert.patientId = :patientId', { patientId })
      .orderBy('alert.createdAt', 'DESC');

    if (!includeResolved) {
      query.andWhere('alert.isResolved = :isResolved', { isResolved: false });
    }

    return query.getMany();
  }

  private async createAndSaveAlert(
    alertData: Omit<
      ClinicalAlertEntity,
      'alertId' | 'isResolved' | 'resolvedBy' | 'resolvedAt' | 'overrideReason' | 'createdAt'
    >,
  ): Promise<ClinicalAlert> {
    const entity = this.alertRepo.create({
      ...alertData,
      alertId: uuidv4(),
      isResolved: false,
    });

    const saved = await this.alertRepo.save(entity);

    return {
      alertId: saved.alertId,
      alertType: saved.alertType,
      severity: saved.severity as AlertSeverity,
      title: saved.title,
      message: saved.message,
      patientId: saved.patientId,
      affectedCodes: saved.affectedCodes,
      recommendations: saved.recommendations,
      references: saved.references,
      createdAt: saved.createdAt,
      requiresAcknowledgment: saved.requiresAcknowledgment,
      isActionable: saved.isActionable,
    };
  }
}
