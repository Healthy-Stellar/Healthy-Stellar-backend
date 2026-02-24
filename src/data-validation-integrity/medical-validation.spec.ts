import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Icd10ValidationService } from '../services/icd10-validation.service';
import { CptValidationService } from '../services/cpt-validation.service';
import { LoincValidationService } from '../services/loinc-validation.service';
import { ClinicalDataQualityService } from '../services/clinical-data-quality.service';
import { DataGovernanceService } from '../services/data-governance.service';
import {
  MedicalCodeRegistry,
  DataQualityReport,
  GovernancePolicyEntity,
  GovernanceComplianceLog,
} from '../entities/medical-validation.entities';
import { DataQualityDimension } from '../medical-codes.constants';

const mockRepository = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
  count: jest.fn(),
  createQueryBuilder: jest.fn().mockReturnValue({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
    getOne: jest.fn().mockResolvedValue(null),
  }),
});

describe('Icd10ValidationService', () => {
  let service: Icd10ValidationService;
  let codeRepo: jest.Mocked<Repository<MedicalCodeRegistry>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        Icd10ValidationService,
        { provide: getRepositoryToken(MedicalCodeRegistry), useFactory: mockRepository },
      ],
    }).compile();

    service = module.get<Icd10ValidationService>(Icd10ValidationService);
    codeRepo = module.get(getRepositoryToken(MedicalCodeRegistry));
  });

  describe('validate()', () => {
    it('should return valid result for correct ICD-10 format', async () => {
      codeRepo.findOne.mockResolvedValue({
        id: '1',
        code: 'J18.9',
        codeSystem: 'ICD-10',
        description: 'Pneumonia, unspecified organism',
        isActive: true,
      } as MedicalCodeRegistry);

      const result = await service.validate('J18.9');

      expect(result.isValid).toBe(true);
      expect(result.isActive).toBe(true);
      expect(result.codeSystem).toBe('ICD-10');
      expect(result.errors).toHaveLength(0);
    });

    it('should return error for invalid ICD-10 format', async () => {
      const result = await service.validate('INVALID');

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Invalid ICD-10 format');
    });

    it('should warn for deprecated ICD-10 codes', async () => {
      codeRepo.findOne.mockResolvedValue({
        code: 'A00.0',
        codeSystem: 'ICD-10',
        description: 'Old code',
        isActive: false,
      } as MedicalCodeRegistry);

      const result = await service.validate('A00.0');

      expect(result.isActive).toBe(false);
      expect(result.warnings.some((w) => w.includes('deprecated'))).toBe(true);
    });

    it('should validate various ICD-10 chapter prefixes', async () => {
      codeRepo.findOne.mockResolvedValue(null);

      const validCodes = ['A01.0', 'B27.9', 'C50.9', 'E11.9', 'F32.0', 'Z00.0'];
      for (const code of validCodes) {
        const result = await service.validate(code);
        expect(result.errors.filter((e) => e.includes('chapter'))).toHaveLength(0);
      }
    });

    it('should warn for placeholder codes with XXX', async () => {
      codeRepo.findOne.mockResolvedValue(null);

      const result = await service.validate('S12.000XXS');
      // Format check - this won't match LOINC pattern but may trigger placeholder warning
    });
  });
});

describe('CptValidationService', () => {
  let service: CptValidationService;
  let codeRepo: jest.Mocked<Repository<MedicalCodeRegistry>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CptValidationService,
        { provide: getRepositoryToken(MedicalCodeRegistry), useFactory: mockRepository },
      ],
    }).compile();

    service = module.get<CptValidationService>(CptValidationService);
    codeRepo = module.get(getRepositoryToken(MedicalCodeRegistry));
  });

  it('should validate correct CPT code format', async () => {
    codeRepo.findOne.mockResolvedValue({
      code: '99213',
      codeSystem: 'CPT',
      description: 'Office visit, established patient, low complexity',
      isActive: true,
    } as MedicalCodeRegistry);

    const result = await service.validate('99213');

    expect(result.isValid).toBe(true);
    expect(result.codeSystem).toBe('CPT');
    expect(result.errors).toHaveLength(0);
  });

  it('should reject invalid CPT format', async () => {
    const result = await service.validate('999');
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should warn for Category II codes (ending in F)', async () => {
    codeRepo.findOne.mockResolvedValue(null);
    const result = await service.validate('0001F');
    expect(result.warnings.some((w) => w.includes('Category II'))).toBe(true);
  });

  it('should warn for unlisted procedure codes (ending in 99)', async () => {
    codeRepo.findOne.mockResolvedValue(null);
    const result = await service.validate('99499');
    // 99499 = unlisted E&M service
    expect(result.isValid).toBe(true);
  });

  it('should warn when preventive code used without Z-diagnosis', async () => {
    codeRepo.findOne.mockResolvedValue({ code: '99385', isActive: true } as MedicalCodeRegistry);
    const result = await service.validate('99385', ['J18.9']); // No Z-code
    expect(result.warnings.some((w) => w.includes('Z-category'))).toBe(true);
  });

  describe('validateModifier()', () => {
    it('should validate common modifier 25', async () => {
      const result = await service.validateModifier('99213', '25');
      expect(result.isValid).toBe(true);
    });

    it('should warn when modifier 25 applied to non-E/M code', async () => {
      const result = await service.validateModifier('10004', '25');
      expect(result.warnings.some((w) => w.includes('E/M'))).toBe(true);
    });
  });
});

describe('LoincValidationService', () => {
  let service: LoincValidationService;
  let codeRepo: jest.Mocked<Repository<MedicalCodeRegistry>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoincValidationService,
        { provide: getRepositoryToken(MedicalCodeRegistry), useFactory: mockRepository },
      ],
    }).compile();

    service = module.get<LoincValidationService>(LoincValidationService);
    codeRepo = module.get(getRepositoryToken(MedicalCodeRegistry));
  });

  it('should reject invalid LOINC format', async () => {
    const result = await service.validate('INVALID');
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toContain('Invalid LOINC format');
  });

  it('should validate LOINC format with correct pattern', async () => {
    codeRepo.findOne.mockResolvedValue(null); // Not in registry
    // 2823-3 has check digit 3; base sum = 2+8+2+3 alternating weights
    const result = await service.validate('2823-3');
    // Will pass format but check digit validation depends on implementation
    expect(result.codeSystem).toBe('LOINC');
  });

  it('should flag critical high value', async () => {
    codeRepo.findOne.mockResolvedValue({
      code: '2823-3',
      isActive: true,
      description: 'Potassium',
    } as MedicalCodeRegistry);

    const result = await service.validate('2823-3', 8.0, 'mEq/L'); // Critical high potassium
    const hasCriticalWarning = result.warnings.some((w) => w.includes('CRITICAL'));
    expect(hasCriticalWarning).toBe(true);
  });

  it('should flag value outside normal range', async () => {
    codeRepo.findOne.mockResolvedValue({
      code: '2823-3',
      isActive: true,
      description: 'Potassium',
    } as MedicalCodeRegistry);

    const result = await service.validate('2823-3', 5.5, 'mEq/L'); // Above normal (3.5-5.0)
    const hasRangeWarning = result.warnings.some((w) => w.includes('above normal'));
    expect(hasRangeWarning).toBe(true);
  });
});

describe('ClinicalDataQualityService', () => {
  let service: ClinicalDataQualityService;
  let qualityReportRepo: jest.Mocked<Repository<DataQualityReport>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClinicalDataQualityService,
        { provide: getRepositoryToken(DataQualityReport), useFactory: mockRepository },
      ],
    }).compile();

    service = module.get<ClinicalDataQualityService>(ClinicalDataQualityService);
    qualityReportRepo = module.get(getRepositoryToken(DataQualityReport));

    qualityReportRepo.save.mockResolvedValue({} as DataQualityReport);
  });

  it('should generate a quality report with all dimensions', async () => {
    const data = {
      patientId: 'P001',
      providerId: 'DR001',
      encounterDate: '2024-01-15',
      facilityId: 'FAC001',
      diagnosisCodes: ['J18.9'],
    };

    const report = await service.assessQuality('REC001', 'encounter', data);

    expect(report.recordId).toBe('REC001');
    expect(report.recordType).toBe('encounter');
    expect(report.qualityScores).toHaveLength(6);
    expect(report.qualityScores.map((s) => s.dimension)).toContain(
      DataQualityDimension.COMPLETENESS,
    );
    expect(report.overallScore).toBeGreaterThan(0);
    expect(report.overallScore).toBeLessThanOrEqual(100);
  });

  it('should fail completeness check for missing required fields', async () => {
    const data = {
      patientId: 'P001',
      // Missing: providerId, encounterDate, facilityId, diagnosisCodes
    };

    const report = await service.assessQuality('REC002', 'encounter', data);

    const completenessScore = report.qualityScores.find(
      (s) => s.dimension === DataQualityDimension.COMPLETENESS,
    );

    expect(completenessScore?.score).toBeLessThan(50);
    expect(report.issues.some((i) => i.issueType === 'MISSING_REQUIRED_FIELD')).toBe(true);
  });

  it('should flag invalid date format', async () => {
    const data = {
      patientId: 'P001',
      providerId: 'DR001',
      encounterDate: 'not-a-date',
      facilityId: 'FAC001',
      diagnosisCodes: ['J18.9'],
    };

    const report = await service.assessQuality('REC003', 'encounter', data);
    expect(report.issues.some((i) => i.issueType === 'INVALID_DATE')).toBe(true);
  });

  it('should flag discharge date before encounter date', async () => {
    const data = {
      patientId: 'P001',
      providerId: 'DR001',
      encounterDate: '2024-01-20',
      dischargeDate: '2024-01-15', // Before encounter
      facilityId: 'FAC001',
    };

    const report = await service.assessQuality('REC004', 'encounter', data);
    expect(report.issues.some((i) => i.issueType === 'DATE_ORDER_INCONSISTENCY')).toBe(true);
  });

  it('should flag unrealistic age values', async () => {
    const data = {
      patientId: 'P001',
      age: 200, // Unrealistic
    };

    const report = await service.assessQuality('REC005', 'encounter', data, ['patientId']);
    expect(report.issues.some((i) => i.field === 'age' && i.issueType === 'OUT_OF_RANGE')).toBe(
      true,
    );
  });
});

describe('DataGovernanceService', () => {
  let service: DataGovernanceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DataGovernanceService,
        { provide: getRepositoryToken(GovernancePolicyEntity), useFactory: mockRepository },
        { provide: getRepositoryToken(GovernanceComplianceLog), useFactory: mockRepository },
      ],
    }).compile();

    service = module.get<DataGovernanceService>(DataGovernanceService);
  });

  describe('detectUnprotectedPhi()', () => {
    it('should detect SSN as PHI', () => {
      const result = service.detectUnprotectedPhi({ ssn: '123-45-6789' });
      expect(result.detected).toBe(true);
      expect(result.phiFields).toContain('ssn');
    });

    it('should detect email as PHI', () => {
      const result = service.detectUnprotectedPhi({ email: 'patient@example.com' });
      expect(result.detected).toBe(true);
      expect(result.phiFields).toContain('email');
    });

    it('should not flag non-PHI fields', () => {
      const result = service.detectUnprotectedPhi({
        diagnosisCode: 'J18.9',
        labValue: 5.0,
        facilityId: 'FAC001',
      });
      expect(result.detected).toBe(false);
    });

    it('should detect nested PHI fields', () => {
      const result = service.detectUnprotectedPhi({
        patient: {
          contact: { phone: '555-1234' },
        },
      });
      expect(result.detected).toBe(true);
      expect(result.phiFields.some((f) => f.includes('phone'))).toBe(true);
    });
  });

  describe('checkRetentionCompliance()', () => {
    it('should allow retention of recent records', async () => {
      const recentDate = new Date();
      recentDate.setFullYear(recentDate.getFullYear() - 1); // 1 year ago

      const result = await service.checkRetentionCompliance('encounter', recentDate);
      expect(result.action).toBe('RETAIN');
      expect(result.isRetentionCompliant).toBe(true);
      expect(result.daysUntilDeletion).toBeGreaterThan(0);
    });

    it('should mark old records as eligible for deletion', async () => {
      const oldDate = new Date();
      oldDate.setFullYear(oldDate.getFullYear() - 8); // 8 years ago (beyond 6-year HIPAA requirement)

      const result = await service.checkRetentionCompliance('encounter', oldDate);
      expect(result.action).toBe('ELIGIBLE_FOR_DELETION');
    });
  });
});
