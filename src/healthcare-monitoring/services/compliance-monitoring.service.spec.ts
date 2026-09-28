import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ComplianceMonitoringService } from './compliance-monitoring.service';
import { ComplianceCheck } from '../entities/compliance-check.entity';
import { ComplianceStatus } from '../enums/compliance-status.enum';
import { ComplianceType } from '../enums/compliance-type.enum';

describe('ComplianceMonitoringService', () => {
  let service: ComplianceMonitoringService;
  let repository: { find: jest.Mock };

  beforeEach(async () => {
    repository = { find: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ComplianceMonitoringService,
        {
          provide: getRepositoryToken(ComplianceCheck),
          useValue: repository,
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

      repository.find.mockResolvedValue(checks);

      const result = await service.getComplianceStatus();

      const bucket = result.byType[complianceType];
      expect(bucket).toBeDefined();
      expect(bucket.compliant).toBe(1);
      expect(bucket.nonCompliant).toBe(1);
      expect(bucket.pendingReview).toBe(1);
      expect(bucket.remediationRequired).toBe(1);

      // No stray keys or NaN values should be produced.
      expect(Object.keys(bucket).sort()).toEqual(
        ['compliant', 'nonCompliant', 'pendingReview', 'remediationRequired'].sort(),
      );
      Object.values(bucket).forEach((value) => {
        expect(Number.isNaN(value)).toBe(false);
      });
    });
  });
});
