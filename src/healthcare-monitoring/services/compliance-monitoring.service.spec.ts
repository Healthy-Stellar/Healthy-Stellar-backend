import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ComplianceMonitoringService } from './compliance-monitoring.service';
import { ClinicalAlertService } from './clinical-alert.service';
import {
  ComplianceCheck,
  ComplianceStatus,
  ComplianceType,
  ComplianceSeverity,
} from '../entities/compliance-check.entity';

describe('ComplianceMonitoringService', () => {
  let service: ComplianceMonitoringService;
  let repository: {
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    createQueryBuilder: jest.Mock;
  };

  beforeEach(async () => {
    repository = {
      find: jest.fn(),
      create: jest.fn((x) => x),
      save: jest.fn((x) => Promise.resolve(x)),
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ComplianceMonitoringService,
        {
          provide: getRepositoryToken(ComplianceCheck),
          useValue: repository,
        },
        {
          provide: ClinicalAlertService,
          useValue: { createAlert: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    service = module.get<ComplianceMonitoringService>(ComplianceMonitoringService);
  });

  describe('getComplianceStatus', () => {
    it('counts each status into the correct per-type bucket without NaN values', async () => {
      const complianceType = ComplianceType.HIPAA;
      const checks = [
        { complianceType, status: ComplianceStatus.COMPLIANT },
        { complianceType, status: ComplianceStatus.NON_COMPLIANT },
        { complianceType, status: ComplianceStatus.PENDING_REVIEW },
        { complianceType, status: ComplianceStatus.REMEDIATION_REQUIRED },
      ] as ComplianceCheck[];

      repository.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(checks),
      });

      const result = await service.getComplianceStatus();

      const bucket = result.byType[complianceType];
      expect(bucket).toBeDefined();
      expect(bucket.compliant).toBe(1);
      expect(bucket.nonCompliant).toBe(1);
      expect(bucket.pendingReview).toBe(1);
      expect(bucket.remediationRequired).toBe(1);

      expect(Object.keys(bucket).sort()).toEqual(
        ['compliant', 'nonCompliant', 'pendingReview', 'remediationRequired'].sort(),
      );
      Object.values(bucket).forEach((value) => {
        expect(Number.isNaN(value)).toBe(false);
      });
    });
  });

  describe('verify implementations', () => {
    it('marks unimplemented checks as pending review instead of fabricating compliance', async () => {
      const dataEncryptionResult = await (service as any).verifyDataEncryption();
      const mfaResult = await (service as any).verifyMfaCompliance();

      expect(dataEncryptionResult.status).toBe(ComplianceStatus.PENDING_REVIEW);
      expect(mfaResult.status).toBe(ComplianceStatus.PENDING_REVIEW);
      expect(dataEncryptionResult.findings).toContain('pending review');
      expect(mfaResult.findings).toContain('pending review');
      expect(dataEncryptionResult.severity).toBe(ComplianceSeverity.MEDIUM);
    });
  });
});
