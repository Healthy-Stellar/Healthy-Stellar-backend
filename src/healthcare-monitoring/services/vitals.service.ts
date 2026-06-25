import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PatientVital } from '../entities/patient-vital.entity';
import { SubmitVitalsDto } from '../dto/submit-vitals.dto';
import { ClinicalAlertService } from './clinical-alert.service';
import { AlertPriority } from '../entities/clinical-alert.entity';

export interface VitalsThresholdBreach {
  metric: string;
  value: number;
  threshold: { min?: number; max?: number };
  severity: 'warning' | 'critical';
}

export interface VitalsSubmissionResult {
  vital: PatientVital;
  breaches: VitalsThresholdBreach[];
}

const THRESHOLDS = {
  heartRate: {
    critical: { min: 40, max: 150 },
    warning: { min: 50, max: 120 },
  },
  systolicBp: {
    critical: { min: 70, max: 200 },
    warning: { min: 90, max: 160 },
  },
  diastolicBp: {
    critical: { min: 40, max: 130 },
    warning: { min: 60, max: 100 },
  },
  oxygenSaturation: {
    critical: { min: 90 },
    warning: { min: 94 },
  },
  temperature: {
    critical: { min: 35.0, max: 40.0 },
    warning: { min: 36.0, max: 38.5 },
  },
  respiratoryRate: {
    critical: { min: 8, max: 30 },
    warning: { min: 12, max: 20 },
  },
  bloodGlucose: {
    critical: { min: 50, max: 400 },
    warning: { min: 70, max: 250 },
  },
} as const;

@Injectable()
export class VitalsService {
  private readonly logger = new Logger(VitalsService.name);

  constructor(
    @InjectRepository(PatientVital)
    private readonly vitalsRepo: Repository<PatientVital>,
    private readonly alertService: ClinicalAlertService,
  ) {}

  async submit(dto: SubmitVitalsDto, recordedBy: string, tenantId?: string): Promise<VitalsSubmissionResult> {
    const vital = this.vitalsRepo.create({
      patientId: dto.patientId,
      tenantId,
      heartRate: dto.heartRate,
      systolicBp: dto.systolicBp,
      diastolicBp: dto.diastolicBp,
      oxygenSaturation: dto.oxygenSaturation,
      temperature: dto.temperature,
      respiratoryRate: dto.respiratoryRate,
      bloodGlucose: dto.bloodGlucose,
      notes: dto.notes,
      recordedBy,
    });

    const saved = await this.vitalsRepo.save(vital);
    const breaches = this.evaluateThresholds(dto);

    if (breaches.length > 0) {
      await this.raiseAlerts(dto.patientId, saved, breaches);
    }

    return { vital: saved, breaches };
  }

  async getLatestForPatient(patientId: string, tenantId?: string): Promise<PatientVital | null> {
    const where: Record<string, string> = { patientId };
    if (tenantId) where.tenantId = tenantId;
    return this.vitalsRepo.findOne({ where, order: { recordedAt: 'DESC' } });
  }

  async getHistoryForPatient(
    patientId: string,
    limit = 100,
    tenantId?: string,
  ): Promise<PatientVital[]> {
    const where: Record<string, string> = { patientId };
    if (tenantId) where.tenantId = tenantId;
    return this.vitalsRepo.find({ where, order: { recordedAt: 'DESC' }, take: limit });
  }

  private evaluateThresholds(dto: SubmitVitalsDto): VitalsThresholdBreach[] {
    const breaches: VitalsThresholdBreach[] = [];

    for (const [metric, value] of Object.entries(dto) as [string, number][]) {
      if (metric === 'patientId' || metric === 'notes' || value == null) continue;
      const config = THRESHOLDS[metric as keyof typeof THRESHOLDS];
      if (!config) continue;

      const isCritical = this.breachesThreshold(value, config.critical);
      if (isCritical) {
        breaches.push({ metric, value, threshold: config.critical, severity: 'critical' });
        continue;
      }

      const isWarning = this.breachesThreshold(value, config.warning);
      if (isWarning) {
        breaches.push({ metric, value, threshold: config.warning, severity: 'warning' });
      }
    }

    return breaches;
  }

  private breachesThreshold(
    value: number,
    threshold: { min?: number; max?: number },
  ): boolean {
    if (threshold.min !== undefined && value < threshold.min) return true;
    if (threshold.max !== undefined && value > threshold.max) return true;
    return false;
  }

  private async raiseAlerts(
    patientId: string,
    vital: PatientVital,
    breaches: VitalsThresholdBreach[],
  ): Promise<void> {
    const hasCritical = breaches.some((b) => b.severity === 'critical');
    const priority = hasCritical ? AlertPriority.CRITICAL : AlertPriority.HIGH;

    const breachDescriptions = breaches
      .map((b) => {
        const bounds = [
          b.threshold.min !== undefined ? `min ${b.threshold.min}` : null,
          b.threshold.max !== undefined ? `max ${b.threshold.max}` : null,
        ]
          .filter(Boolean)
          .join(', ');
        return `${b.metric}: ${b.value} (${b.severity}, ${bounds})`;
      })
      .join('; ');

    await this.alertService.createCriticalVitalsAlert(patientId, {
      vitalId: vital.id,
      recordedAt: vital.recordedAt,
      breaches,
      summary: breachDescriptions,
    });

    this.logger.warn(
      `Vitals threshold breach for patient ${patientId}: ${breachDescriptions}`,
    );
  }
}
