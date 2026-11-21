import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClinicalGuideline } from '../entities/clinical-guideline.entity';
import { DecisionSupportAlert } from '../entities/decision-support-alert.entity';
import { AlertType, AlertSeverity } from '../../common/enums';

@Injectable()
export class DecisionSupportService {
  constructor(
    @InjectRepository(ClinicalGuideline)
    private readonly guidelineRepository: Repository<ClinicalGuideline>,
    @InjectRepository(DecisionSupportAlert)
    private readonly alertRepository: Repository<DecisionSupportAlert>,
  ) {}

  async findGuidelinesByDiagnosisCode(icd10Code: string): Promise<ClinicalGuideline[]> {
    return await this.guidelineRepository
      .createQueryBuilder('guideline')
      .where(':code = ANY(guideline.icd10Codes)', { code: icd10Code })
      .andWhere('guideline.isActive = :isActive', { isActive: true })
      .getMany();
  }

  async createAlert(
    alertType: AlertType,
    severity: AlertSeverity,
    title: string,
    message: string,
    options?: {
      patientId?: string;
      treatmentPlanId?: string;
      diagnosisId?: string;
      recommendation?: string;
      supportingEvidence?: any[];
      guidelineId?: string;
      triggeredBy?: any;
    },
  ): Promise<DecisionSupportAlert> {
    const alert = this.alertRepository.create({
      alertType,
      severity,
      title,
      message,
      ...options,
    });

    return await this.alertRepository.save(alert);
  }

  async getPatientAlerts(
    patientId: string,
    includeAcknowledged = false,
  ): Promise<DecisionSupportAlert[]> {
    const queryBuilder = this.alertRepository
      .createQueryBuilder('alert')
      .where('alert.patientId = :patientId', { patientId })
      .andWhere('alert.dismissed = :dismissed', { dismissed: false })
      .orderBy('alert.severity', 'DESC')
      .addOrderBy('alert.createdAt', 'DESC');

    if (!includeAcknowledged) {
      queryBuilder.andWhere('alert.acknowledged = :acknowledged', { acknowledged: false });
    }

    return await queryBuilder.getMany();
  }

  async acknowledgeAlert(
    alertId: string,
    acknowledgedBy: string,
    notes?: string,
  ): Promise<DecisionSupportAlert> {
    const alert = await this.alertRepository.findOne({ where: { id: alertId } });

    if (!alert) {
      throw new NotFoundException('Alert not found');
    }

    alert.acknowledged = true;
    alert.acknowledgedBy = acknowledgedBy;
    alert.acknowledgedAt = new Date();
    alert.acknowledgedNotes = notes;

    return await this.alertRepository.save(alert);
  }

  async dismissAlert(alertId: string, reason?: string): Promise<DecisionSupportAlert> {
    const alert = await this.alertRepository.findOne({ where: { id: alertId } });

    if (!alert) {
      throw new NotFoundException('Alert not found');
    }

    alert.dismissed = true;
    alert.dismissalReason = reason;

    return await this.alertRepository.save(alert);
  }

  async evaluateTreatmentPlan(
    treatmentPlanId: string,
    diagnosisIds: string[],
  ): Promise<DecisionSupportAlert[]> {
    const alerts: DecisionSupportAlert[] = [];

    // Find relevant guidelines for each diagnosis
    for (const diagnosisId of diagnosisIds) {
      // This is a simplified implementation
      // In a real system, you would fetch the actual ICD-10 code from the diagnosis
      // and match it against guidelines
      const guidelines = await this.guidelineRepository.find({
        where: { isActive: true },
        take: 5,
      });

      for (const guideline of guidelines) {
        if (guideline.recommendedInterventions && guideline.recommendedInterventions.length > 0) {
          const alert = await this.createAlert(
            AlertType.GUIDELINE_RECOMMENDATION,
            AlertSeverity.INFO,
            `Guideline Recommendation: ${guideline.name}`,
            `Consider the following recommendations based on ${guideline.source}`,
            {
              treatmentPlanId,
              diagnosisId,
              recommendation: guideline.recommendedInterventions
                .map((i) => i.intervention)
                .join(', '),
              guidelineId: guideline.id,
              supportingEvidence: [
                {
                  source: guideline.source,
                  evidenceLevel: guideline.overallEvidenceLevel,
                },
              ],
            },
          );
          alerts.push(alert);
        }
      }
    }

    return alerts;
  }
}
