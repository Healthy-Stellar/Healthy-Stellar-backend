import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Prescription } from '../entities/prescription.entity';
import { Drug } from '../entities/drug.entity';
import { ControlledSubstanceSchedule } from '../entities/drug.entity';
import { SafetyAlert } from '../entities/safety-alert.entity';
import { PdmpService } from './pdmp.service';
import {
  PrescriptionValidationError,
  PrescriptionValidationErrorCode,
} from '../errors/prescription-validation.error';

const SCHEDULE_II_MAX_AGE_DAYS = 90;

export interface PatientFactors {
  age: number;
  weight?: number; // kg
  height?: number; // cm
  renalFunction?: 'normal' | 'mild' | 'moderate' | 'severe' | 'dialysis';
  hepaticFunction?: 'normal' | 'mild' | 'moderate' | 'severe';
  pregnancy?: boolean;
  breastfeeding?: boolean;
  allergies: string[];
  medicalConditions: string[];
}

export interface ValidationResult {
  isValid: boolean;
  errors: PrescriptionValidationError[];
  alerts: Array<{
    type: string;
    severity: 'minor' | 'moderate' | 'major' | 'critical';
    message: string;
    recommendation: string;
  }>;
}

@Injectable()
export class PrescriptionValidationService {
  constructor(
    @InjectRepository(Prescription)
    private prescriptionRepository: Repository<Prescription>,
    @InjectRepository(Drug)
    private drugRepository: Repository<Drug>,
    @InjectRepository(SafetyAlert)
    private alertRepository: Repository<SafetyAlert>,
    private readonly pdmpService: PdmpService,
  ) {}

  async validatePrescription(
    prescriptionId: string,
    patientFactors: PatientFactors,
    prescriberDeaNumber?: string,
  ): Promise<ValidationResult> {
    const prescription = await this.prescriptionRepository.findOne({
      where: { id: prescriptionId },
      relations: ['items', 'items.drug'],
    });

    if (!prescription) {
      return {
        isValid: false,
        errors: [
          new PrescriptionValidationError(
            PrescriptionValidationErrorCode.DEA_NUMBER_REQUIRED,
            'Prescription not found',
          ),
        ],
        alerts: [
          {
            type: 'prescription-not-found',
            severity: 'critical',
            message: 'Prescription not found',
            recommendation: 'Verify prescription ID',
          },
        ],
      };
    }

    const errors: PrescriptionValidationError[] = [];
    const alerts = [];

    // ── DEA / Schedule II rules ──────────────────────────────────────────────
    const controlledErrors = await this.validateControlledSubstance(
      prescription,
      prescriberDeaNumber,
    );
    errors.push(...controlledErrors);

    // ── PDMP check ───────────────────────────────────────────────────────────
    const pdmpErrors = await this.validatePdmp(prescription.patientId);
    errors.push(...pdmpErrors);

    // ── Per-drug clinical rules ──────────────────────────────────────────────
    for (const item of prescription.items) {
      const drug = item.drug;

      const ageAlerts = this.validateAgeAppropriate(drug, patientFactors.age, item);
      alerts.push(...ageAlerts);

      if (patientFactors.renalFunction && patientFactors.renalFunction !== 'normal') {
        alerts.push(...this.validateRenalDosing(drug, patientFactors.renalFunction, item));
      }

      if (patientFactors.hepaticFunction && patientFactors.hepaticFunction !== 'normal') {
        alerts.push(...this.validateHepaticDosing(drug, patientFactors.hepaticFunction, item));
      }

      if (patientFactors.pregnancy) {
        alerts.push(...this.validatePregnancySafety(drug, item));
      }

      if (patientFactors.breastfeeding) {
        alerts.push(...this.validateBreastfeedingSafety(drug, item));
      }

      if (patientFactors.weight) {
        alerts.push(...this.validateWeightBasedDosing(drug, patientFactors.weight, item));
      }

      alerts.push(...this.validateMedicalConditions(drug, patientFactors.medicalConditions, item));
      alerts.push(...this.validateRouteAndForm(drug, item));
    }

    alerts.push(...this.validateOverallPrescription(prescription, patientFactors));

    const criticalAlerts = alerts.filter((a) => a.severity === 'critical');
    const isValid = errors.length === 0 && criticalAlerts.length === 0;

    return { isValid, errors, alerts };
  }

  // ── DEA / Schedule II validation ──────────────────────────────────────────

  private async validateControlledSubstance(
    prescription: Prescription,
    prescriberDeaNumber?: string,
  ): Promise<PrescriptionValidationError[]> {
    const errors: PrescriptionValidationError[] = [];
    const schedule = prescription.controlledSubstanceSchedule;

    if (!schedule) return errors;

    // All controlled substances require a DEA number
    if (!prescriberDeaNumber?.trim()) {
      errors.push(
        new PrescriptionValidationError(
          PrescriptionValidationErrorCode.DEA_NUMBER_REQUIRED,
          `A valid DEA registration number is required to prescribe Schedule ${schedule} controlled substances.`,
        ),
      );
    }

    if (schedule === ControlledSubstanceSchedule.SCHEDULE_II) {
      // CII: no refills allowed
      if (prescription.refills > 0) {
        errors.push(
          new PrescriptionValidationError(
            PrescriptionValidationErrorCode.SCHEDULE_II_NO_REFILLS,
            `Schedule II prescriptions may not have refills. This prescription specifies ${prescription.refills} refill(s).`,
          ),
        );
      }

      // CII: must be filled within 90 days of the written date
      const writtenDate = new Date(prescription.prescribedDate);
      const ageInDays = (Date.now() - writtenDate.getTime()) / 86_400_000;
      if (ageInDays > SCHEDULE_II_MAX_AGE_DAYS) {
        errors.push(
          new PrescriptionValidationError(
            PrescriptionValidationErrorCode.SCHEDULE_II_EXPIRED,
            `Schedule II prescription is ${Math.floor(ageInDays)} days old. Maximum fill age is ${SCHEDULE_II_MAX_AGE_DAYS} days.`,
          ),
        );
      }
    }

    return errors;
  }

  // ── PDMP validation ───────────────────────────────────────────────────────

  private async validatePdmp(patientId: string): Promise<PrescriptionValidationError[]> {
    const history = await this.pdmpService.getPatientHistory(patientId);
    if (!history) return [];

    const errors: PrescriptionValidationError[] = [];

    // Flag if patient has received controlled substances from 3+ prescribers or pharmacies in 90 days
    if (history.multiplePrescriberCount >= 3 || history.multiplePharmacyCount >= 3) {
      errors.push(
        new PrescriptionValidationError(
          PrescriptionValidationErrorCode.PDMP_FLAG,
          `PDMP history indicates potential misuse: ${history.multiplePrescriberCount} prescribers and ${history.multiplePharmacyCount} pharmacies in the past 90 days.`,
          'major',
        ),
      );
    }

    return errors;
  }

  private validateAgeAppropriate(drug: Drug, age: number, item: any): any[] {
    const alerts = [];

    // Pediatric considerations (< 18 years)
    if (age < 18) {
      // Check for pediatric contraindications
      if (
        drug.contraindications?.some(
          (ci) => ci.toLowerCase().includes('pediatric') || ci.toLowerCase().includes('children'),
        )
      ) {
        alerts.push({
          type: 'pediatric-contraindication',
          severity: 'critical',
          message: `${drug.genericName} is contraindicated in pediatric patients`,
          recommendation: 'Contact prescriber for alternative therapy',
        });
      }

      // Specific age-based warnings
      if (age < 2 && drug.genericName.toLowerCase().includes('aspirin')) {
        alerts.push({
          type: 'reye-syndrome-risk',
          severity: 'critical',
          message: 'Aspirin use in children under 2 years increases Reye syndrome risk',
          recommendation: 'Do not dispense. Contact prescriber immediately.',
        });
      }
    }

    // Geriatric considerations (≥ 65 years)
    if (age >= 65) {
      // Beers Criteria medications (simplified examples)
      const beersListDrugs = [
        'diphenhydramine',
        'hydroxyzine',
        'promethazine',
        'diazepam',
        'lorazepam',
        'alprazolam',
        'zolpidem',
        'eszopiclone',
        'amitriptyline',
        'doxepin',
      ];

      if (
        beersListDrugs.some((beers) => drug.genericName.toLowerCase().includes(beers.toLowerCase()))
      ) {
        alerts.push({
          type: 'beers-criteria',
          severity: 'major',
          message: `${drug.genericName} is potentially inappropriate for elderly patients (Beers Criteria)`,
          recommendation: 'Consider alternative therapy or reduced dosing',
        });
      }

      // High-dose warnings for elderly
      if (
        drug.genericName.toLowerCase().includes('morphine') &&
        this.extractDoseAmount(item.dosageInstructions) > 30
      ) {
        alerts.push({
          type: 'geriatric-high-dose',
          severity: 'major',
          message: 'High-dose opioid in elderly patient',
          recommendation: 'Verify dose appropriateness with prescriber',
        });
      }
    }

    return alerts;
  }

  private validateRenalDosing(drug: Drug, renalFunction: string, item: any): any[] {
    const alerts = [];

    // Drugs requiring renal dose adjustment (simplified list)
    const renalAdjustmentDrugs = [
      'metformin',
      'gabapentin',
      'pregabalin',
      'atenolol',
      'digoxin',
      'lithium',
      'vancomycin',
      'gentamicin',
      'tobramycin',
      'amikacin',
    ];

    const requiresAdjustment = renalAdjustmentDrugs.some((renalDrug) =>
      drug.genericName.toLowerCase().includes(renalDrug.toLowerCase()),
    );

    if (requiresAdjustment) {
      const severity =
        renalFunction === 'severe' || renalFunction === 'dialysis' ? 'critical' : 'major';

      alerts.push({
        type: 'renal-dose-adjustment',
        severity,
        message: `${drug.genericName} requires dose adjustment in ${renalFunction} renal impairment`,
        recommendation: 'Verify dose is appropriate for renal function',
      });
    }

    // Contraindicated in severe renal impairment
    if (
      (renalFunction === 'severe' || renalFunction === 'dialysis') &&
      drug.genericName.toLowerCase().includes('metformin')
    ) {
      alerts.push({
        type: 'renal-contraindication',
        severity: 'critical',
        message: 'Metformin is contraindicated in severe renal impairment',
        recommendation: 'Do not dispense. Contact prescriber for alternative.',
      });
    }

    return alerts;
  }

  private validateHepaticDosing(drug: Drug, hepaticFunction: string, item: any): any[] {
    const alerts = [];

    // Drugs requiring hepatic dose adjustment
    const hepaticAdjustmentDrugs = [
      'warfarin',
      'phenytoin',
      'carbamazepine',
      'valproic acid',
      'propranolol',
      'morphine',
      'codeine',
      'tramadol',
      'acetaminophen',
    ];

    const requiresAdjustment = hepaticAdjustmentDrugs.some((hepaticDrug) =>
      drug.genericName.toLowerCase().includes(hepaticDrug.toLowerCase()),
    );

    if (requiresAdjustment) {
      const severity = hepaticFunction === 'severe' ? 'critical' : 'major';

      alerts.push({
        type: 'hepatic-dose-adjustment',
        severity,
        message: `${drug.genericName} requires dose adjustment in ${hepaticFunction} hepatic impairment`,
        recommendation: 'Verify dose is appropriate for hepatic function',
      });
    }

    // Acetaminophen daily dose limit in hepatic impairment
    if (drug.genericName.toLowerCase().includes('acetaminophen') && hepaticFunction !== 'normal') {
      const dailyDose = this.calculateDailyAcetaminophenDose(item.dosageInstructions);
      if (dailyDose > 2000) {
        // 2g limit in hepatic impairment
        alerts.push({
          type: 'hepatic-dose-limit',
          severity: 'critical',
          message: `Acetaminophen daily dose (${dailyDose}mg) exceeds safe limit for hepatic impairment (2000mg)`,
          recommendation: 'Reduce dose or contact prescriber',
        });
      }
    }

    return alerts;
  }

  private validatePregnancySafety(drug: Drug, item: any): any[] {
    const alerts = [];

    // Pregnancy category X drugs (contraindicated)
    const categoryXDrugs = [
      'warfarin',
      'isotretinoin',
      'thalidomide',
      'methotrexate',
      'misoprostol',
      'finasteride',
      'dutasteride',
      'atorvastatin',
      'simvastatin',
    ];

    if (
      categoryXDrugs.some((catX) => drug.genericName.toLowerCase().includes(catX.toLowerCase()))
    ) {
      alerts.push({
        type: 'pregnancy-contraindicated',
        severity: 'critical',
        message: `${drug.genericName} is contraindicated in pregnancy`,
        recommendation: 'Do not dispense. Contact prescriber immediately for alternative.',
      });
    }

    // Pregnancy category D drugs (risk but may be necessary)
    const categoryDDrugs = [
      'phenytoin',
      'carbamazepine',
      'valproic acid',
      'lithium',
      'atenolol',
      'lisinopril',
      'losartan',
      'tetracycline',
      'doxycycline',
    ];

    if (
      categoryDDrugs.some((catD) => drug.genericName.toLowerCase().includes(catD.toLowerCase()))
    ) {
      alerts.push({
        type: 'pregnancy-risk',
        severity: 'major',
        message: `${drug.genericName} has known pregnancy risks`,
        recommendation: 'Verify risk/benefit assessment with prescriber',
      });
    }

    return alerts;
  }

  private validateBreastfeedingSafety(drug: Drug, item: any): any[] {
    const alerts = [];

    // Drugs contraindicated in breastfeeding
    const contraindicatedInBF = [
      'lithium',
      'amiodarone',
      'chloramphenicol',
      'tetracycline',
      'ciprofloxacin',
      'metronidazole',
      'ergotamine',
      'bromocriptine',
    ];

    if (
      contraindicatedInBF.some((bf) => drug.genericName.toLowerCase().includes(bf.toLowerCase()))
    ) {
      alerts.push({
        type: 'breastfeeding-contraindicated',
        severity: 'major',
        message: `${drug.genericName} is not recommended during breastfeeding`,
        recommendation:
          'Discuss alternatives with prescriber or temporary cessation of breastfeeding',
      });
    }

    return alerts;
  }

  private validateWeightBasedDosing(drug: Drug, weight: number, item: any): any[] {
    const alerts = [];

    // Example: Enoxaparin dosing based on weight
    if (drug.genericName.toLowerCase().includes('enoxaparin')) {
      const dose = this.extractDoseAmount(item.dosageInstructions);
      const expectedDose = weight * 1; // 1 mg/kg for treatment dose

      if (Math.abs(dose - expectedDose) > expectedDose * 0.2) {
        // 20% variance
        alerts.push({
          type: 'weight-based-dosing',
          severity: 'major',
          message: `Enoxaparin dose (${dose}mg) may not be appropriate for weight (${weight}kg, expected ~${expectedDose}mg)`,
          recommendation: 'Verify weight-based dosing calculation',
        });
      }
    }

    return alerts;
  }

  private validateMedicalConditions(drug: Drug, conditions: string[], item: any): any[] {
    const alerts = [];

    conditions.forEach((condition) => {
      const lowerCondition = condition.toLowerCase();

      // Heart failure contraindications
      if (lowerCondition.includes('heart failure') || lowerCondition.includes('chf')) {
        const hfContraindicated = ['verapamil', 'diltiazem', 'nifedipine', 'ibuprofen', 'naproxen'];
        if (hfContraindicated.some((hf) => drug.genericName.toLowerCase().includes(hf))) {
          alerts.push({
            type: 'heart-failure-contraindication',
            severity: 'major',
            message: `${drug.genericName} may worsen heart failure`,
            recommendation: 'Consider alternative therapy',
          });
        }
      }

      // Asthma/COPD contraindications
      if (lowerCondition.includes('asthma') || lowerCondition.includes('copd')) {
        const respiratoryContraindicated = ['propranolol', 'atenolol', 'metoprolol', 'aspirin'];
        if (
          respiratoryContraindicated.some((resp) => drug.genericName.toLowerCase().includes(resp))
        ) {
          alerts.push({
            type: 'respiratory-contraindication',
            severity: 'major',
            message: `${drug.genericName} may worsen respiratory condition`,
            recommendation: 'Verify appropriateness with prescriber',
          });
        }
      }

      // Diabetes considerations
      if (lowerCondition.includes('diabetes')) {
        const diabetesWarnings = ['prednisone', 'prednisolone', 'hydrochlorothiazide'];
        if (diabetesWarnings.some((dm) => drug.genericName.toLowerCase().includes(dm))) {
          alerts.push({
            type: 'diabetes-monitoring',
            severity: 'moderate',
            message: `${drug.genericName} may affect blood glucose control`,
            recommendation: 'Counsel patient to monitor blood glucose closely',
          });
        }
      }
    });

    return alerts;
  }

  private validateRouteAndForm(drug: Drug, item: any): any[] {
    const alerts = [];

    // Check for route-specific contraindications
    if (drug.route === 'IV' && item.dosageInstructions.toLowerCase().includes('oral')) {
      alerts.push({
        type: 'route-mismatch',
        severity: 'critical',
        message: `Route mismatch: ${drug.genericName} is formulated for ${drug.route} but prescribed for oral use`,
        recommendation: 'Verify intended route with prescriber',
      });
    }

    return alerts;
  }

  private validateOverallPrescription(
    prescription: Prescription,
    patientFactors: PatientFactors,
  ): any[] {
    const alerts = [];

    // Check for polypharmacy in elderly
    if (patientFactors.age >= 65 && prescription.items.length > 5) {
      alerts.push({
        type: 'polypharmacy',
        severity: 'moderate',
        message: `Multiple medications (${prescription.items.length}) in elderly patient`,
        recommendation: 'Review for potential drug interactions and medication optimization',
      });
    }

    return alerts;
  }

  // Helper methods
  private extractDoseAmount(dosageInstructions: string): number {
    const match = dosageInstructions.match(/(\d+(?:\.\d+)?)\s*mg/i);
    return match ? parseFloat(match[1]) : 0;
  }

  private calculateDailyAcetaminophenDose(dosageInstructions: string): number {
    const doseMatch = dosageInstructions.match(/(\d+(?:\.\d+)?)\s*mg/i);
    const frequencyMatch = dosageInstructions.match(
      /(\d+)\s*times?\s*(?:per\s*)?day|every\s*(\d+)\s*hours?/i,
    );

    const dose = doseMatch ? parseFloat(doseMatch[1]) : 0;
    let frequency = 1;

    if (frequencyMatch) {
      if (frequencyMatch[1]) {
        frequency = parseInt(frequencyMatch[1]);
      } else if (frequencyMatch[2]) {
        frequency = 24 / parseInt(frequencyMatch[2]);
      }
    }

    return dose * frequency;
  }
}
