import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  GovernancePolicyEntity,
  GovernanceComplianceLog,
} from '../entities/medical-validation.entities';
import {
  GovernanceComplianceResult,
  GovernanceViolation,
} from '../interfaces/validation-result.interface';
import { GovernancePolicyType } from '../medical-codes.constants';

interface PolicyRule {
  ruleId: string;
  ruleName: string;
  check: (data: Record<string, unknown>) => { passes: boolean; violation?: GovernanceViolation };
}

@Injectable()
export class DataGovernanceService {
  private readonly logger = new Logger(DataGovernanceService.name);

  constructor(
    @InjectRepository(GovernancePolicyEntity)
    private readonly policyRepo: Repository<GovernancePolicyEntity>,
    @InjectRepository(GovernanceComplianceLog)
    private readonly complianceLogRepo: Repository<GovernanceComplianceLog>,
  ) {}

  /**
   * Check a data record against all active governance policies
   */
  async enforceGovernancePolicies(
    resourceId: string,
    resourceType: string,
    data: Record<string, unknown>,
    checkedBy?: string,
  ): Promise<GovernanceComplianceResult[]> {
    const activePolicies = await this.policyRepo.find({
      where: { isActive: true },
    });

    const results: GovernanceComplianceResult[] = [];

    for (const policy of activePolicies) {
      const result = await this.evaluatePolicy(policy, data);
      results.push(result);

      // Log compliance result
      await this.complianceLogRepo.save({
        policyId: policy.id,
        resourceId,
        resourceType,
        isCompliant: result.isCompliant,
        violations: result.violations as unknown as Record<string, unknown>[],
        checkedBy,
      });
    }

    return results;
  }

  /**
   * Create or update a governance policy
   */
  async upsertPolicy(policyData: {
    policyName: string;
    policyType: string;
    rules: Record<string, unknown>;
    effectiveDate: Date;
    expiryDate?: Date;
    isActive: boolean;
    createdBy?: string;
  }): Promise<GovernancePolicyEntity> {
    const existing = await this.policyRepo.findOne({
      where: { policyName: policyData.policyName },
    });

    if (existing) {
      await this.policyRepo.update(existing.id, policyData);
      return this.policyRepo.findOne({ where: { id: existing.id } });
    }

    return this.policyRepo.save(policyData);
  }

  /**
   * Get compliance summary for an organization
   */
  async getComplianceSummary(
    resourceType?: string,
    days: number = 30,
  ): Promise<{
    totalChecks: number;
    compliantChecks: number;
    complianceRate: number;
    topViolations: { policyName: string; count: number }[];
    trend: { date: string; complianceRate: number }[];
  }> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const qb = this.complianceLogRepo
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.policy', 'policy')
      .where('log.checkedAt >= :since', { since });

    if (resourceType) {
      qb.andWhere('log.resourceType = :resourceType', { resourceType });
    }

    const logs = await qb.getMany();

    const totalChecks = logs.length;
    const compliantChecks = logs.filter((l) => l.isCompliant).length;
    const complianceRate = totalChecks > 0 ? (compliantChecks / totalChecks) * 100 : 100;

    // Top violations
    const violationCounts = new Map<string, number>();
    for (const log of logs.filter((l) => !l.isCompliant)) {
      const policyName = log.policy?.policyName || log.policyId;
      violationCounts.set(policyName, (violationCounts.get(policyName) || 0) + 1);
    }
    const topViolations = Array.from(violationCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([policyName, count]) => ({ policyName, count }));

    // Daily trend
    const trendMap = new Map<string, { total: number; compliant: number }>();
    for (const log of logs) {
      const date = log.checkedAt.toISOString().split('T')[0];
      const existing = trendMap.get(date) || { total: 0, compliant: 0 };
      existing.total++;
      if (log.isCompliant) existing.compliant++;
      trendMap.set(date, existing);
    }
    const trend = Array.from(trendMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, { total, compliant }]) => ({
        date,
        complianceRate: Math.round((compliant / total) * 100),
      }));

    return {
      totalChecks,
      compliantChecks,
      complianceRate: Math.round(complianceRate * 100) / 100,
      topViolations,
      trend,
    };
  }

  /**
   * PHI field detection - identify potentially unprotected PHI
   */
  detectUnprotectedPhi(data: Record<string, unknown>): {
    detected: boolean;
    phiFields: string[];
    recommendations: string[];
  } {
    const phiFieldPatterns = [
      /ssn|social.?security/i,
      /dob|date.?of.?birth|birth.?date/i,
      /mrn|medical.?record/i,
      /phone|telephone/i,
      /address|street|city|zip/i,
      /email/i,
      /name$/i,
      /account.?number/i,
      /license.?number/i,
      /device.?identifier/i,
      /ip.?address/i,
      /biometric/i,
    ];

    const phiFields: string[] = [];

    const checkObject = (obj: Record<string, unknown>, prefix: string = ''): void => {
      for (const [key, value] of Object.entries(obj)) {
        const fieldPath = prefix ? `${prefix}.${key}` : key;
        const isPhi = phiFieldPatterns.some((pattern) => pattern.test(key));
        if (isPhi) phiFields.push(fieldPath);

        if (value && typeof value === 'object' && !Array.isArray(value)) {
          checkObject(value as Record<string, unknown>, fieldPath);
        }
      }
    };

    checkObject(data);

    const recommendations: string[] = [];
    if (phiFields.length > 0) {
      recommendations.push('Ensure PHI fields are encrypted at rest and in transit.');
      recommendations.push('Verify access is restricted to authorized personnel only.');
      recommendations.push('Implement field-level encryption for highly sensitive identifiers.');
      recommendations.push('Review audit logging for PHI field access.');
    }

    return {
      detected: phiFields.length > 0,
      phiFields,
      recommendations,
    };
  }

  /**
   * Data retention compliance check
   */
  async checkRetentionCompliance(
    recordType: string,
    createdAt: Date,
  ): Promise<{ isRetentionCompliant: boolean; action: string; daysUntilDeletion?: number }> {
    // HIPAA: Medical records must be retained for 6 years from date of creation
    // or last effective date, whichever is later
    const retentionPeriods: Record<string, number> = {
      encounter: 6 * 365, // 6 years
      lab_result: 6 * 365, // 6 years
      medication: 6 * 365, // 6 years
      imaging: 7 * 365, // 7 years
      mental_health: 7 * 365, // often longer for mental health
      pediatric: 21 * 365, // until patient turns 21
    };

    const retentionDays = retentionPeriods[recordType] || retentionPeriods.encounter;
    const expiryDate = new Date(createdAt);
    expiryDate.setDate(expiryDate.getDate() + retentionDays);

    const now = new Date();
    const daysUntilDeletion = Math.ceil(
      (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysUntilDeletion > 0) {
      return {
        isRetentionCompliant: true,
        action: 'RETAIN',
        daysUntilDeletion,
      };
    } else {
      return {
        isRetentionCompliant: true, // Still compliant - can now be deleted
        action: 'ELIGIBLE_FOR_DELETION',
      };
    }
  }

  private async evaluatePolicy(
    policy: GovernancePolicyEntity,
    data: Record<string, unknown>,
  ): Promise<GovernanceComplianceResult> {
    const violations: GovernanceViolation[] = [];
    const rules = policy.rules;

    // Evaluate built-in rule types based on policy type
    switch (policy.policyType as GovernancePolicyType) {
      case GovernancePolicyType.DATA_QUALITY:
        violations.push(...this.evaluateDataQualityRules(rules, data));
        break;

      case GovernancePolicyType.PHI_PROTECTION:
        violations.push(...this.evaluatePhiProtectionRules(rules, data));
        break;

      case GovernancePolicyType.CONSENT_MANAGEMENT:
        violations.push(...this.evaluateConsentRules(rules, data));
        break;

      case GovernancePolicyType.AUDIT_REQUIREMENT:
        violations.push(...this.evaluateAuditRules(rules, data));
        break;

      default:
        this.logger.warn(`Unknown policy type: ${policy.policyType}`);
    }

    return {
      policyId: policy.id,
      policyName: policy.policyName,
      isCompliant: violations.length === 0,
      violations,
      lastCheckedAt: new Date(),
    };
  }

  private evaluateDataQualityRules(
    rules: Record<string, unknown>,
    data: Record<string, unknown>,
  ): GovernanceViolation[] {
    const violations: GovernanceViolation[] = [];
    const requiredFields = (rules.requiredFields as string[]) || [];
    const minCompletenessScore = (rules.minCompletenessScore as number) || 80;

    for (const field of requiredFields) {
      if (!data[field]) {
        violations.push({
          ruleId: `DQ_REQUIRED_${field.toUpperCase()}`,
          ruleName: `Required field: ${field}`,
          severity: 'HIGH',
          description: `Required field "${field}" is missing from the record.`,
          affectedField: field,
          remediationSteps: [
            `Populate the "${field}" field before saving.`,
            'Update source system data mapping.',
          ],
        });
      }
    }

    return violations;
  }

  private evaluatePhiProtectionRules(
    rules: Record<string, unknown>,
    data: Record<string, unknown>,
  ): GovernanceViolation[] {
    const violations: GovernanceViolation[] = [];
    const phiCheck = this.detectUnprotectedPhi(data);

    if (phiCheck.detected && rules.requireEncryption) {
      violations.push({
        ruleId: 'PHI_ENCRYPTION_REQUIRED',
        ruleName: 'PHI Encryption Requirement',
        severity: 'CRITICAL',
        description: `PHI fields detected without confirmed encryption: ${phiCheck.phiFields.join(', ')}`,
        remediationSteps: phiCheck.recommendations,
      });
    }

    return violations;
  }

  private evaluateConsentRules(
    rules: Record<string, unknown>,
    data: Record<string, unknown>,
  ): GovernanceViolation[] {
    const violations: GovernanceViolation[] = [];

    if (rules.requireConsent && !data['consentObtained']) {
      violations.push({
        ruleId: 'CONSENT_REQUIRED',
        ruleName: 'Patient Consent Requirement',
        severity: 'CRITICAL',
        description: 'Patient consent has not been documented for this record.',
        affectedField: 'consentObtained',
        remediationSteps: [
          'Obtain and document patient consent before proceeding.',
          'Record consent date, type, and consent form version.',
        ],
      });
    }

    return violations;
  }

  private evaluateAuditRules(
    rules: Record<string, unknown>,
    data: Record<string, unknown>,
  ): GovernanceViolation[] {
    const violations: GovernanceViolation[] = [];

    if (rules.requireCreatedBy && !data['createdBy']) {
      violations.push({
        ruleId: 'AUDIT_CREATED_BY_REQUIRED',
        ruleName: 'Audit: Creator Required',
        severity: 'HIGH',
        description: 'Record must have a "createdBy" field for audit trail compliance.',
        affectedField: 'createdBy',
        remediationSteps: [
          'Populate createdBy with the authenticated user ID.',
          'Verify audit logging is properly configured.',
        ],
      });
    }

    return violations;
  }
}
