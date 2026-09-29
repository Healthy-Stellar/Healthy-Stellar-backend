import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  ComplianceCheck,
  ComplianceType,
  ComplianceStatus,
  ComplianceSeverity,
} from '../entities/compliance-check.entity';
import { ClinicalAlertService } from './clinical-alert.service';

interface ComplianceTypeBucket {
  compliant: number;
  nonCompliant: number;
  pendingReview: number;
  remediationRequired: number;
}

const STATUS_BUCKET_MAP: Record<ComplianceStatus, keyof ComplianceTypeBucket> = {
  [ComplianceStatus.COMPLIANT]: 'compliant',
  [ComplianceStatus.NON_COMPLIANT]: 'nonCompliant',
  [ComplianceStatus.PENDING_REVIEW]: 'pendingReview',
  [ComplianceStatus.REMEDIATION_REQUIRED]: 'remediationRequired',
};

@Injectable()
export class ComplianceMonitoringService {
  private readonly logger = new Logger(ComplianceMonitoringService.name);

  constructor(
    @InjectRepository(ComplianceCheck)
    private complianceRepository: Repository<ComplianceCheck>,
    private clinicalAlertService: ClinicalAlertService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async runDailyComplianceChecks(): Promise<void> {
    try {
      await Promise.all([
        this.checkHipaaCompliance(),
        this.checkDataSecurityCompliance(),
        this.checkAccessControlCompliance(),
        this.checkAuditLogCompliance(),
      ]);
    } catch (error) {
      this.logger.error('Failed to run daily compliance checks', error);
    }
  }

  @Cron(CronExpression.EVERY_WEEK)
  async runWeeklyComplianceChecks(): Promise<void> {
    try {
      await Promise.all([
        this.checkJointCommissionCompliance(),
        this.checkFdaCompliance(),
        this.checkOshaCompliance(),
      ]);
    } catch (error) {
      this.logger.error('Failed to run weekly compliance checks', error);
    }
  }

  private async checkHipaaCompliance(): Promise<void> {
    const checks = [
      {
        name: 'Patient Data Encryption',
        description: 'Verify all patient data is encrypted at rest and in transit',
        check: () => this.verifyDataEncryption(),
      },
      {
        name: 'Access Control Audit',
        description: 'Verify proper access controls for PHI',
        check: () => this.verifyAccessControls(),
      },
      {
        name: 'Audit Log Integrity',
        description: 'Verify audit logs are complete and tamper-proof',
        check: () => this.verifyAuditLogs(),
      },
    ];

    for (const check of checks) {
      const result = await check.check();
      await this.recordComplianceCheck({
        complianceType: ComplianceType.HIPAA,
        checkName: check.name,
        description: check.description,
        status: result.status ?? (result.compliant ? ComplianceStatus.COMPLIANT : ComplianceStatus.NON_COMPLIANT),
        severity: result.severity || ComplianceSeverity.MEDIUM,
        findings: result.findings,
        recommendations: result.recommendations,
      });
    }
  }

  private async checkDataSecurityCompliance(): Promise<void> {
    const securityChecks = [
      {
        name: 'Password Policy Compliance',
        description: 'Verify password policies meet security standards',
        check: () => this.verifyPasswordPolicies(),
      },
      {
        name: 'Multi-Factor Authentication',
        description: 'Verify MFA is enabled for all users',
        check: () => this.verifyMfaCompliance(),
      },
      {
        name: 'Session Management',
        description: 'Verify secure session management practices',
        check: () => this.verifySessionSecurity(),
      },
    ];

    for (const check of securityChecks) {
      const result = await check.check();
      await this.recordComplianceCheck({
        complianceType: ComplianceType.HITECH,
        checkName: check.name,
        description: check.description,
        status: result.status ?? (result.compliant ? ComplianceStatus.COMPLIANT : ComplianceStatus.NON_COMPLIANT),
        severity: result.severity || ComplianceSeverity.HIGH,
        findings: result.findings,
        recommendations: result.recommendations,
        system: 'security',
      });
    }
  }

  private async checkAccessControlCompliance(): Promise<void> {
    const result = await this.verifyRoleBasedAccess();
    await this.recordComplianceCheck({
      complianceType: ComplianceType.INTERNAL_POLICIES,
      checkName: 'Role-Based Access Control',
      description: 'Verify users have appropriate access levels',
      status: result.status ?? (result.compliant ? ComplianceStatus.COMPLIANT : ComplianceStatus.NON_COMPLIANT),
      severity: result.severity || ComplianceSeverity.HIGH,
      findings: result.findings,
      recommendations: result.recommendations,
      system: 'access-control',
    });
  }

  private async checkAuditLogCompliance(): Promise<void> {
    const result = await this.verifyAuditLogRetention();
    await this.recordComplianceCheck({
      complianceType: ComplianceType.HIPAA,
      checkName: 'Audit Log Retention',
      description: 'Verify audit logs are retained for required period',
      status: result.status ?? (result.compliant ? ComplianceStatus.COMPLIANT : ComplianceStatus.NON_COMPLIANT),
      severity: result.severity || ComplianceSeverity.MEDIUM,
      findings: result.findings,
      recommendations: result.recommendations,
      system: 'audit',
    });
  }

  private async checkJointCommissionCompliance(): Promise<void> {
    const checks = [
      {
        name: 'Patient Safety Goals',
        description: 'Verify compliance with National Patient Safety Goals',
        check: () => this.verifyPatientSafetyGoals(),
      },
      {
        name: 'Medication Management',
        description: 'Verify medication management standards',
        check: () => this.verifyMedicationManagement(),
      },
    ];

    for (const check of checks) {
      const result = await check.check();
      await this.recordComplianceCheck({
        complianceType: ComplianceType.JOINT_COMMISSION,
        checkName: check.name,
        description: check.description,
        status: result.status ?? (result.compliant ? ComplianceStatus.COMPLIANT : ComplianceStatus.NON_COMPLIANT),
        severity: result.severity || ComplianceSeverity.HIGH,
        findings: result.findings,
        recommendations: result.recommendations,
      });
    }
  }

  private async checkFdaCompliance(): Promise<void> {
    const result = await this.verifyMedicalDeviceCompliance();
    await this.recordComplianceCheck({
      complianceType: ComplianceType.FDA,
      checkName: 'Medical Device Compliance',
      description: 'Verify medical devices meet FDA requirements',
      status: result.status ?? (result.compliant ? ComplianceStatus.COMPLIANT : ComplianceStatus.NON_COMPLIANT),
      severity: result.severity || ComplianceSeverity.HIGH,
      findings: result.findings,
      recommendations: result.recommendations,
      system: 'medical-devices',
    });
  }

  private async checkOshaCompliance(): Promise<void> {
    const result = await this.verifyWorkplaceSafety();
    await this.recordComplianceCheck({
      complianceType: ComplianceType.OSHA,
      checkName: 'Workplace Safety Standards',
      description: 'Verify compliance with OSHA safety standards',
      status: result.status ?? (result.compliant ? ComplianceStatus.COMPLIANT : ComplianceStatus.NON_COMPLIANT),
      severity: result.severity || ComplianceSeverity.MEDIUM,
      findings: result.findings,
      recommendations: result.recommendations,
      system: 'safety',
    });
  }

  private async recordComplianceCheck(
    checkData: Partial<ComplianceCheck>,
  ): Promise<ComplianceCheck> {
    const check = this.complianceRepository.create({
      ...checkData,
      checkDate: new Date(),
    });

    const savedCheck = await this.complianceRepository.save(check);

    // Create alert for non-compliant items
    if (
      savedCheck.status === ComplianceStatus.NON_COMPLIANT &&
      savedCheck.severity === ComplianceSeverity.CRITICAL
    ) {
      await this.clinicalAlertService.createAlert({
        alertType: 'REGULATORY_VIOLATION' as any,
        priority: 'critical' as any,
        title: 'Compliance Violation Detected',
        message: `${savedCheck.checkName}: ${savedCheck.findings}`,
        department: savedCheck.department || 'Compliance',
        alertData: { complianceCheckId: savedCheck.id },
      });
    }

    return savedCheck;
  }

  async getComplianceStatus(complianceType?: ComplianceType): Promise<any> {
    const query = this.complianceRepository.createQueryBuilder('check');

    if (complianceType) {
      query.where('check.complianceType = :complianceType', { complianceType });
    }

    const checks = await query.getMany();

    const status = {
      totalChecks: checks.length,
      compliant: 0,
      nonCompliant: 0,
      pendingReview: 0,
      remediationRequired: 0,
      byType: {} as Record<string, ComplianceTypeBucket>,
      bySeverity: {} as Record<string, number>,
      lastCheckDate: null as Date | null,
    };

    for (const check of checks) {
      if (!status.byType[check.complianceType]) {
        status.byType[check.complianceType] = {
          compliant: 0,
          nonCompliant: 0,
          pendingReview: 0,
          remediationRequired: 0,
        };
      }

      const bucketKey = STATUS_BUCKET_MAP[check.status];
      if (bucketKey) {
        status.byType[check.complianceType][bucketKey]++;
      }

      switch (check.status) {
        case ComplianceStatus.COMPLIANT:
          status.compliant++;
          break;
        case ComplianceStatus.NON_COMPLIANT:
          status.nonCompliant++;
          break;
        case ComplianceStatus.PENDING_REVIEW:
          status.pendingReview++;
          break;
        case ComplianceStatus.REMEDIATION_REQUIRED:
          status.remediationRequired++;
          break;
      }

      if (!status.bySeverity[check.severity]) {
        status.bySeverity[check.severity] = 0;
      }
      status.bySeverity[check.severity]++;

      if (!status.lastCheckDate || check.checkDate > status.lastCheckDate) {
        status.lastCheckDate = check.checkDate;
      }
    }

    return status;
  }

  private async verifyDataEncryption(): Promise<any> {
    return this.pendingReviewResult(
      'Data encryption',
      'Encryption settings are not yet validated automatically; confirm key management and storage configuration before reporting compliance.',
      ComplianceSeverity.MEDIUM,
    );
  }

  private async verifyAccessControls(): Promise<any> {
    return this.pendingReviewResult(
      'Access controls',
      'Access-control review is pending manual validation and cannot be treated as an automated compliance finding.',
      ComplianceSeverity.HIGH,
    );
  }

  private async verifyAuditLogs(): Promise<any> {
    return this.pendingReviewResult(
      'Audit log integrity',
      'Audit-log hash-chain verification is not yet automated; log integrity cannot be claimed without manual review.',
      ComplianceSeverity.HIGH,
    );
  }

  private async verifyPasswordPolicies(): Promise<any> {
    return this.pendingReviewResult(
      'Password policy compliance',
      'Password-policy enforcement is pending a manual security review.',
      ComplianceSeverity.MEDIUM,
    );
  }

  private async verifyMfaCompliance(): Promise<any> {
    return this.pendingReviewResult(
      'MFA compliance',
      'MFA coverage is pending review; no automated coverage decision should be saved as evidence.',
      ComplianceSeverity.HIGH,
    );
  }

  private async verifySessionSecurity(): Promise<any> {
    return this.pendingReviewResult(
      'Session security',
      'Session hardening review is pending and should not be stored as a verified compliance result.',
      ComplianceSeverity.MEDIUM,
    );
  }

  private async verifyRoleBasedAccess(): Promise<any> {
    return this.pendingReviewResult(
      'Role-based access control',
      'RBAC verification is pending review; the system cannot claim automated access-control compliance.',
      ComplianceSeverity.HIGH,
    );
  }

  private async verifyAuditLogRetention(): Promise<any> {
    return this.pendingReviewResult(
      'Audit log retention',
      'Retention verification is pending manual review and is not yet backed by evidence.',
      ComplianceSeverity.MEDIUM,
    );
  }

  private async verifyPatientSafetyGoals(): Promise<any> {
    return this.pendingReviewResult(
      'Patient safety goals',
      'The patient-safety goal check is not yet implemented and remains pending review.',
      ComplianceSeverity.HIGH,
    );
  }

  private async verifyMedicationManagement(): Promise<any> {
    return this.pendingReviewResult(
      'Medication management',
      'Medication management compliance is pending review and cannot be relied upon as a validated result.',
      ComplianceSeverity.HIGH,
    );
  }

  private async verifyMedicalDeviceCompliance(): Promise<any> {
    return this.pendingReviewResult(
      'Medical device compliance',
      'Medical-device compliance is not automated here and requires a manual assessment before being recorded.',
      ComplianceSeverity.HIGH,
    );
  }

  private async verifyWorkplaceSafety(): Promise<any> {
    return this.pendingReviewResult(
      'Workplace safety',
      'Occupational safety review is not yet automated and remains pending manual validation.',
      ComplianceSeverity.MEDIUM,
    );
  }

  private pendingReviewResult(
    checkName: string,
    detail: string,
    severity: ComplianceSeverity = ComplianceSeverity.MEDIUM,
  ) {
    return {
      compliant: false,
      status: ComplianceStatus.PENDING_REVIEW,
      severity,
      findings: `${checkName}: pending review - ${detail}`,
      recommendations: ['Manual compliance review required before this control can be treated as verified.'],
    };
  }
}
