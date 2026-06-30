import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AlertRule, AlertOperator } from '../entities/alert-rule.entity';
import { ClinicalAlert, AlertType } from '../entities/clinical-alert.entity';
import { ClinicalAlertService } from './clinical-alert.service';
import { CreateAlertRuleDto } from '../dto/create-alert-rule.dto';
import { PatientVital } from '../entities/patient-vital.entity';

@Injectable()
export class AlertRuleService {
  private readonly logger = new Logger(AlertRuleService.name);

  constructor(
    @InjectRepository(AlertRule)
    private readonly ruleRepo: Repository<AlertRule>,
    private readonly clinicalAlertService: ClinicalAlertService,
  ) {}

  async create(dto: CreateAlertRuleDto, createdBy: string, tenantId?: string): Promise<AlertRule> {
    const rule = this.ruleRepo.create({
      ...dto,
      isActive: dto.isActive ?? true,
      createdBy,
      tenantId,
    });
    const saved = await this.ruleRepo.save(rule);
    this.logger.log(`Alert rule created: ${saved.id} — "${saved.name}" for patient ${saved.patientId}`);
    return saved;
  }

  async findAll(patientId?: string, tenantId?: string): Promise<AlertRule[]> {
    const where: Record<string, any> = {};
    if (patientId) where.patientId = patientId;
    if (tenantId) where.tenantId = tenantId;
    return this.ruleRepo.find({ where, order: { createdAt: 'DESC' } });
  }

  /**
   * Evaluate a saved vital reading against all active rules for that patient.
   * Fires a ClinicalAlert (and downstream notifications) for every rule that matches.
   * Designed to complete within the 5-second SLA by running rules in parallel.
   */
  async evaluateVitals(vital: PatientVital, tenantId?: string): Promise<ClinicalAlert[]> {
    const rules = await this.ruleRepo.find({
      where: {
        patientId: vital.patientId,
        isActive: true,
        ...(tenantId ? { tenantId } : {}),
      },
    });

    if (rules.length === 0) return [];

    const results = await Promise.all(
      rules.map((rule) => this.evaluateRule(rule, vital)),
    );

    return results.filter((a): a is ClinicalAlert => a !== null);
  }

  /** Pure comparison — exposed for unit testing. */
  matches(value: number, operator: AlertOperator, threshold: number): boolean {
    switch (operator) {
      case AlertOperator.GT:  return value > threshold;
      case AlertOperator.GTE: return value >= threshold;
      case AlertOperator.LT:  return value < threshold;
      case AlertOperator.LTE: return value <= threshold;
      case AlertOperator.EQ:  return value === threshold;
    }
  }

  private async evaluateRule(
    rule: AlertRule,
    vital: PatientVital,
  ): Promise<ClinicalAlert | null> {
    const raw = vital[rule.metricName as keyof PatientVital];
    if (raw == null) return null;

    const value = Number(raw);
    if (!this.matches(value, rule.operator, rule.threshold)) return null;

    this.logger.warn(
      `Rule "${rule.name}" [${rule.id}] fired: patient=${vital.patientId} ` +
      `${rule.metricName}=${value} ${rule.operator} ${rule.threshold}`,
    );

    return this.clinicalAlertService.createAlert({
      alertType: AlertType.CRITICAL_VITALS,
      priority: rule.priority,
      title: rule.name,
      message:
        `Threshold breached — ${rule.metricName}: ${value} ` +
        `(rule: ${rule.operator} ${rule.threshold})`,
      patientId: vital.patientId,
      alertData: {
        ruleId: rule.id,
        metricName: rule.metricName,
        value,
        operator: rule.operator,
        threshold: rule.threshold,
        vitalId: vital.id,
        recordedAt: vital.recordedAt,
      },
    });
  }
}
