import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AlertRuleService } from './alert-rule.service';
import { AlertRule, AlertOperator } from '../entities/alert-rule.entity';
import { ClinicalAlertService } from './clinical-alert.service';
import { AlertPriority, AlertStatus, AlertType, ClinicalAlert } from '../entities/clinical-alert.entity';
import { PatientVital } from '../entities/patient-vital.entity';
import { CreateAlertRuleDto } from '../dto/create-alert-rule.dto';

// ── Helpers ──────────────────────────────────────────────────────────────────

const patientId = 'patient-uuid-001';
const tenantId = 'tenant-uuid-001';
const createdBy = 'clinician-uuid-001';

function makeRule(overrides: Partial<AlertRule> = {}): AlertRule {
  return {
    id: 'rule-uuid-001',
    patientId,
    tenantId,
    metricName: 'heartRate',
    operator: AlertOperator.GT,
    threshold: 120,
    priority: AlertPriority.HIGH,
    isActive: true,
    name: 'High Heart Rate',
    description: null,
    createdBy,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as AlertRule;
}

function makeVital(overrides: Partial<PatientVital> = {}): PatientVital {
  return {
    id: 'vital-uuid-001',
    patientId,
    tenantId,
    heartRate: 100,
    systolicBp: 120,
    diastolicBp: 80,
    oxygenSaturation: 98,
    temperature: 37,
    respiratoryRate: 16,
    bloodGlucose: 90,
    recordedBy: createdBy,
    notes: null,
    recordedAt: new Date(),
    ...overrides,
  } as PatientVital;
}

function makeAlert(overrides: Partial<ClinicalAlert> = {}): ClinicalAlert {
  return {
    id: 'alert-uuid-001',
    alertType: AlertType.CRITICAL_VITALS,
    priority: AlertPriority.HIGH,
    status: AlertStatus.ACTIVE,
    title: 'High Heart Rate',
    message: 'Threshold breached',
    patientId,
    department: null,
    room: null,
    equipmentId: null,
    assignedTo: null,
    acknowledgedBy: null,
    acknowledgedAt: null,
    resolvedBy: null,
    resolvedAt: null,
    resolutionNotes: null,
    alertData: {},
    notificationChannels: ['dashboard', 'email'],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as ClinicalAlert;
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe('AlertRuleService', () => {
  let service: AlertRuleService;
  let ruleRepo: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
  };
  let clinicalAlertService: { createAlert: jest.Mock };

  beforeEach(async () => {
    ruleRepo = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
    };

    clinicalAlertService = {
      createAlert: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertRuleService,
        {
          provide: getRepositoryToken(AlertRule),
          useValue: ruleRepo,
        },
        {
          provide: ClinicalAlertService,
          useValue: clinicalAlertService,
        },
      ],
    }).compile();

    service = module.get<AlertRuleService>(AlertRuleService);
  });

  // ── matches() ──────────────────────────────────────────────────────────────

  describe('matches()', () => {
    it.each<[AlertOperator, number, number, boolean]>([
      // GT
      [AlertOperator.GT,  130, 120, true],
      [AlertOperator.GT,  120, 120, false],
      [AlertOperator.GT,  110, 120, false],
      // GTE
      [AlertOperator.GTE, 120, 120, true],
      [AlertOperator.GTE, 121, 120, true],
      [AlertOperator.GTE, 119, 120, false],
      // LT
      [AlertOperator.LT,  50, 60, true],
      [AlertOperator.LT,  60, 60, false],
      [AlertOperator.LT,  70, 60, false],
      // LTE
      [AlertOperator.LTE, 60, 60, true],
      [AlertOperator.LTE, 59, 60, true],
      [AlertOperator.LTE, 61, 60, false],
      // EQ
      [AlertOperator.EQ,  37, 37, true],
      [AlertOperator.EQ,  37, 36, false],
    ])('operator=%s value=%d threshold=%d → %s', (op, value, threshold, expected) => {
      expect(service.matches(value, op, threshold)).toBe(expected);
    });
  });

  // ── create() ──────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('persists a new rule and returns it', async () => {
      const dto: CreateAlertRuleDto = {
        patientId,
        metricName: 'heartRate',
        operator: AlertOperator.GT,
        threshold: 120,
        priority: AlertPriority.HIGH,
        name: 'High Heart Rate',
      };

      const created = makeRule();
      ruleRepo.create.mockReturnValue(created);
      ruleRepo.save.mockResolvedValue(created);

      const result = await service.create(dto, createdBy, tenantId);

      expect(ruleRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          patientId,
          metricName: 'heartRate',
          operator: AlertOperator.GT,
          threshold: 120,
          priority: AlertPriority.HIGH,
          name: 'High Heart Rate',
          isActive: true,
          createdBy,
          tenantId,
        }),
      );
      expect(ruleRepo.save).toHaveBeenCalledWith(created);
      expect(result).toBe(created);
    });

    it('defaults isActive to true when not provided', async () => {
      const dto: CreateAlertRuleDto = {
        patientId,
        metricName: 'heartRate',
        operator: AlertOperator.GT,
        threshold: 120,
        priority: AlertPriority.HIGH,
        name: 'Test Rule',
      };

      const created = makeRule();
      ruleRepo.create.mockReturnValue(created);
      ruleRepo.save.mockResolvedValue(created);

      await service.create(dto, createdBy);

      expect(ruleRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: true }),
      );
    });
  });

  // ── findAll() ─────────────────────────────────────────────────────────────

  describe('findAll()', () => {
    it('returns all rules without filter', async () => {
      const rules = [makeRule()];
      ruleRepo.find.mockResolvedValue(rules);

      const result = await service.findAll();

      expect(ruleRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: {}, order: { createdAt: 'DESC' } }),
      );
      expect(result).toBe(rules);
    });

    it('filters by patientId and tenantId when provided', async () => {
      ruleRepo.find.mockResolvedValue([]);

      await service.findAll(patientId, tenantId);

      expect(ruleRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { patientId, tenantId },
        }),
      );
    });
  });

  // ── evaluateVitals() ──────────────────────────────────────────────────────

  describe('evaluateVitals()', () => {
    it('returns an empty array when no rules exist for the patient', async () => {
      ruleRepo.find.mockResolvedValue([]);

      const result = await service.evaluateVitals(makeVital());

      expect(result).toEqual([]);
      expect(clinicalAlertService.createAlert).not.toHaveBeenCalled();
    });

    it('fires an alert when a rule matches', async () => {
      const rule = makeRule({ operator: AlertOperator.GT, threshold: 120 });
      ruleRepo.find.mockResolvedValue([rule]);

      const alert = makeAlert();
      clinicalAlertService.createAlert.mockResolvedValue(alert);

      // heartRate=130 > threshold=120 → should trigger
      const vital = makeVital({ heartRate: 130 });
      const result = await service.evaluateVitals(vital, tenantId);

      expect(clinicalAlertService.createAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          alertType: AlertType.CRITICAL_VITALS,
          priority: AlertPriority.HIGH,
          patientId,
          alertData: expect.objectContaining({
            ruleId: rule.id,
            metricName: 'heartRate',
            value: 130,
          }),
        }),
      );
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(alert);
    });

    it('does not fire an alert when no rule matches', async () => {
      const rule = makeRule({ operator: AlertOperator.GT, threshold: 120 });
      ruleRepo.find.mockResolvedValue([rule]);

      // heartRate=100 ≤ threshold=120 → no breach
      const vital = makeVital({ heartRate: 100 });
      const result = await service.evaluateVitals(vital, tenantId);

      expect(clinicalAlertService.createAlert).not.toHaveBeenCalled();
      expect(result).toHaveLength(0);
    });

    it('skips a rule when the metric field is null on the vital', async () => {
      const rule = makeRule({ metricName: 'bloodGlucose', operator: AlertOperator.GT, threshold: 200 });
      ruleRepo.find.mockResolvedValue([rule]);

      // bloodGlucose not recorded
      const vital = makeVital({ bloodGlucose: null as any });
      const result = await service.evaluateVitals(vital, tenantId);

      expect(clinicalAlertService.createAlert).not.toHaveBeenCalled();
      expect(result).toHaveLength(0);
    });

    it('fires multiple alerts when multiple rules match', async () => {
      const rule1 = makeRule({ id: 'rule-1', metricName: 'heartRate', operator: AlertOperator.GT, threshold: 120 });
      const rule2 = makeRule({ id: 'rule-2', metricName: 'systolicBp', operator: AlertOperator.GTE, threshold: 180 });
      ruleRepo.find.mockResolvedValue([rule1, rule2]);

      const alert1 = makeAlert({ id: 'alert-1' });
      const alert2 = makeAlert({ id: 'alert-2' });
      clinicalAlertService.createAlert
        .mockResolvedValueOnce(alert1)
        .mockResolvedValueOnce(alert2);

      const vital = makeVital({ heartRate: 150, systolicBp: 195 });
      const result = await service.evaluateVitals(vital, tenantId);

      expect(clinicalAlertService.createAlert).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(2);
    });

    it('fires alert with GTE operator at exactly the threshold', async () => {
      const rule = makeRule({ operator: AlertOperator.GTE, threshold: 120 });
      ruleRepo.find.mockResolvedValue([rule]);
      clinicalAlertService.createAlert.mockResolvedValue(makeAlert());

      const vital = makeVital({ heartRate: 120 });
      const result = await service.evaluateVitals(vital, tenantId);

      expect(result).toHaveLength(1);
    });

    it('fires alert with LT operator when value is below threshold', async () => {
      const rule = makeRule({
        metricName: 'oxygenSaturation',
        operator: AlertOperator.LT,
        threshold: 90,
        priority: AlertPriority.CRITICAL,
      });
      ruleRepo.find.mockResolvedValue([rule]);
      clinicalAlertService.createAlert.mockResolvedValue(makeAlert());

      const vital = makeVital({ oxygenSaturation: 85 });
      const result = await service.evaluateVitals(vital, tenantId);

      expect(clinicalAlertService.createAlert).toHaveBeenCalledWith(
        expect.objectContaining({ priority: AlertPriority.CRITICAL }),
      );
      expect(result).toHaveLength(1);
    });
  });
});
