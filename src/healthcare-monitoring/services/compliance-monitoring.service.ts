import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ComplianceCheck, ComplianceType, ComplianceStatus, ComplianceSeverity } from '../entities/compliance-check.entity';
import { ClinicalAlertService } from './clinical-alert.service';

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
        status: result.compliant ? ComplianceStatus.COMPLIANT : ComplianceStatus.NON_COMPLIANT,
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
        status: result.compliant ? ComplianceStatus.COMPLIANT : ComplianceStatus.NON_COMPLIANT,
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
      status: result.compliant ? ComplianceStatus.COMPLIANT : ComplianceStatus.NON_COMPLIANT,
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
      status: result.compliant ? ComplianceStatus.COMPLIANT : ComplianceStatus.NON_COMPLIANT,
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
        status: result.compliant ? ComplianceStatus.COMPLIANT : ComplianceStatus.NON_COMPLIANT,
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
      status: result.compliant ? ComplianceStatus.COMPLIANT : ComplianceStatus.NON_COMPLIANT,
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
      status: result.compliant ? ComplianceStatus.COMPLIANT : ComplianceStatus.NON_COMPLIANT,
      severity: result.severity || ComplianceSeverity.MEDIUM,
      findings: result.findings,
      recommendations: result.recommendations,
      system: 'safety',
    });
  }

  private async recordComplianceCheck(checkData: Partial<ComplianceCheck>): Promise<ComplianceCheck> {
    const check = this.complianceRepository.create({
      ...checkData,
      checkDate: new Date(),
    });

    const savedCheck = await this.complianceRepository.save(check);

    // Create alert for non-compliant items
    if (savedCheck.status === ComplianceStatus.NON_COMPLIANT && 
        savedCheck.severity === ComplianceSeverity.CRITICAL) {
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
    const query = this.complianceRepository
      .createQueryBuilder('check')
      .where('check.checkDate >= :since', { 
        since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
      });

    if (complianceType) {
      query.andWhere('check.complianceType = :type', { type: complianceType });
    }

    const checks = await query.getMany();

    const status = {
      overall: 'compliant',
      totalChecks: checks.length,
      compliant: 0,
      nonCompliant: 0,
      pendingReview: 0,
      byType: {},
      bySeverity: {},
      recentViolations: [],
    };

    checks.forEach(check => {
      // Count by status
      switch (check.status) {
        case ComplianceStatus.COMPLIANT:
          status.compliant++;
          break;
        case ComplianceStatus.NON_COMPLIANT:
          status.nonCompliant++;
          status.overall = 'non-compliant';
          break;
        case ComplianceStatus.PENDING_REVIEW:
          status.pendingReview++;
          break;
      }

      // Count by type
      status.byType[check.complianceType] = status.byType[check.complianceType] || {
        compliant: 0,
        nonCompliant: 0,
        pendingReview: 0,
      };
      status.byType[check.complianceType][check.status.replace('_', '')]++;

      // Count by severity
      status.bySeverity[check.severity] = (status.bySeverity[check.severity] || 0) + 1;

      // Collect recent violations
      if (check.status === ComplianceStatus.NON_COMPLIANT) {
        status.recentViolations.push({
          type: check.complianceType,
          checkName: check.checkName,
          severity: check.severity,
          findings: check.findings,
          checkDate: check.checkDate,
        });
      }
    });

    return status;
  }

  // Mock compliance check implementations
  private async verifyDataEncryption(): Promise<any> {
    return {
      compliant: Math.random() > 0.1,
      severity: ComplianceSeverity.HIGH,
      findings: 'All patient data encrypted with AES-256',
      recommendations: 'Continue monitoring encryption status',
    };
  }

  private async verifyAccessControls(): Promise<any> {
    return {
      compliant: Math.random() > 0.05,
      severity: ComplianceSeverity.HIGH,
      findings: 'Access controls properly configured',
      recommendations: 'Regular access review recommended',
    };
  }

  private async verifyAuditLogs(): Promise<any> {
    return {
      compliant: Math.random() > 0.02,
      severity: ComplianceSeverity.MEDIUM,
      findings: 'Audit logs complete and secure',
      recommendations: 'Continue current audit practices',
    };
  }

  private async verifyPasswordPolicies(): Promise<any> {
    return {
      compliant: Math.random() > 0.1,
      severity: ComplianceSeverity.MEDIUM,
      findings: 'Password policies meet requirements',
      recommendations: 'Consider implementing password rotation',
    };
  }

  private async verifyMfaCompliance(): Promise<any> {
    return {
      compliant: Math.random() > 0.15,
      severity: ComplianceSeverity.HIGH,
      findings: 'MFA enabled for 95% of users',
      recommendations: 'Enforce MFA for remaining users',
    };
  }

  private async verifySessionSecurity(): Promise<any> {
    return {
      compliant: Math.random() > 0.05,
      severity: ComplianceSeverity.MEDIUM,
      findings: 'Session management secure',
      recommendations: 'Continue current practices',
    };
  }

  private async verifyRoleBasedAccess(): Promise<any> {
    return {
      compliant: Math.random() > 0.1,
      severity: ComplianceSeverity.HIGH,
      findings: 'Role-based access properly implemented',
      recommendations: 'Regular access reviews needed',
    };
  }

  private async verifyAuditLogRetention(): Promise<any> {
    return {
      compliant: Math.random() > 0.05,
      severity: ComplianceSeverity.MEDIUM,
      findings: 'Audit logs retained for required period',
      recommendations: 'Continue current retention policy',
    };
  }

  private async verifyPatientSafetyGoals(): Promise<any> {
    return {
      compliant: Math.random() > 0.1,
      severity: ComplianceSeverity.HIGH,
      findings: 'Patient safety goals implemented',
      recommendations: 'Continue monitoring safety metrics',
    };
  }

  private async verifyMedicationManagement(): Promise<any> {
    return {
      compliant: Math.random() > 0.08,
      severity: ComplianceSeverity.HIGH,
      findings: 'Medication management standards met',
      recommendations: 'Regular medication safety reviews',
    };
  }

  private async verifyMedicalDeviceCompliance(): Promise<any> {
    return {
      compliant: Math.random() > 0.05,
      severity: ComplianceSeverity.HIGH,
      findings: 'Medical devices FDA compliant',
      recommendations: 'Continue device monitoring',
    };
  }

  private async verifyWorkplaceSafety(): Promise<any> {
    return {
      compliant: Math.random() > 0.1,
      severity: ComplianceSeverity.MEDIUM,
      findings: 'Workplace safety standards met',
      recommendations: 'Regular safety training recommended',
    };
  }
}