import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DiagnosisService } from './services/diagnosis.service';
import { Diagnosis } from './entities/diagnosis.entity';
import { DiagnosisHistory } from './entities/diagnosis-history.entity';
import { TreatmentPlan } from '../treatment-planning/entities/treatment-plan.entity';
import { MedicalCodeService } from '../billing/services/medical-code.service';
import { NotificationsService } from '../notifications/services/notifications.service';
import { CreateDiagnosisDto, UpdateDiagnosisDto } from './dto/diagnosis.dto';
import { DiagnosisStatus, DiagnosisSeverity, CodeType } from '../common/enums';

const makeDiagnosis = (overrides: Partial<Diagnosis> = {}): Diagnosis => ({
  id: 'diagnosis-uuid-1',
  patientId: 'patient-uuid-1',
  providerId: 'provider-uuid-1',
  medicalRecordId: 'record-uuid-1',
  icd10CodeId: 'code-uuid-1',
  icd10Code: {
    id: 'code-uuid-1',
    code: 'E11.9',
    description: 'Type 2 diabetes mellitus without complications',
    codeType: CodeType.ICD10_CM,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  status: DiagnosisStatus.PRELIMINARY,
  severity: DiagnosisSeverity.MODERATE,
  diagnosisDate: new Date('2024-01-15'),
  onsetDate: new Date('2024-01-01'),
  resolvedDate: null,
  clinicalNotes: 'Patient presenting with symptoms consistent with type 2 diabetes',
  presentingSymptoms: 'Fatigue, increased thirst, frequent urination',
  supportingEvidence: {
    labResults: ['fasting-glucose-140-mg-dl'],
    imagingResults: [],
    physicalExamFindings: 'BMI 32, overweight',
  },
  isPrimary: true,
  isChronic: true,
  laterality: null,
  bodyLocation: null,
  metadata: {},
  createdBy: 'user-uuid-1',
  updatedBy: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  history: [],
  ...overrides,
});

describe('DiagnosisService with Notifications', () => {
  let service: DiagnosisService;
  let diagnosisRepo: any;
  let historyRepo: any;
  let treatmentPlanRepo: any;
  let medicalCodeService: any;
  let notificationsService: jest.Mocked<NotificationsService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiagnosisService,
        {
          provide: getRepositoryToken(Diagnosis),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
            createQueryBuilder: jest.fn(),
            remove: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(DiagnosisHistory),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(TreatmentPlan),
          useValue: {
            find: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: MedicalCodeService,
          useValue: {
            findById: jest.fn(),
          },
        },
        {
          provide: NotificationsService,
          useValue: {
            emitDiagnosisCreated: jest.fn(),
            emitDiagnosisSeverityEscalated: jest.fn(),
            emitDiagnosisStatusConfirmed: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<DiagnosisService>(DiagnosisService);
    diagnosisRepo = module.get(getRepositoryToken(Diagnosis));
    historyRepo = module.get(getRepositoryToken(DiagnosisHistory));
    treatmentPlanRepo = module.get(getRepositoryToken(TreatmentPlan));
    medicalCodeService = module.get(MedicalCodeService);
    notificationsService = module.get(NotificationsService) as jest.Mocked<NotificationsService>;
  });

  describe('create', () => {
    it('should emit diagnosis_created notification on diagnosis creation', async () => {
      const createDto: CreateDiagnosisDto = {
        patientId: 'patient-uuid-1',
        providerId: 'provider-uuid-1',
        medicalRecordId: 'record-uuid-1',
        icd10CodeId: 'code-uuid-1',
        severity: DiagnosisSeverity.MODERATE,
        diagnosisDate: new Date('2024-01-15'),
        isPrimary: true,
        isChronic: true,
        clinicalNotes: 'Test diagnosis',
        createdBy: 'user-uuid-1',
      };

      const mockCode = {
        id: 'code-uuid-1',
        code: 'E11.9',
        description: 'Type 2 diabetes mellitus',
        codeType: CodeType.ICD10_CM,
        isActive: true,
      };

      const savedDiagnosis = makeDiagnosis({
        ...createDto,
        id: 'new-diagnosis-uuid',
      });

      medicalCodeService.findById.mockResolvedValue(mockCode);
      diagnosisRepo.create.mockReturnValue(createDto);
      diagnosisRepo.save.mockResolvedValue(savedDiagnosis);
      treatmentPlanRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      });

      const result = await service.create(createDto);

      expect(result.id).toBe('new-diagnosis-uuid');
      expect(notificationsService.emitDiagnosisCreated).toHaveBeenCalledWith(
        'user-uuid-1',
        'new-diagnosis-uuid',
        expect.objectContaining({
          patientId: 'patient-uuid-1',
          providerId: 'provider-uuid-1',
          diagnosisCode: 'E11.9',
          isPrimary: true,
        }),
      );
    });

    it('should emit notification even if createdBy is not provided', async () => {
      const createDto: CreateDiagnosisDto = {
        patientId: 'patient-uuid-1',
        providerId: 'provider-uuid-1',
        medicalRecordId: 'record-uuid-1',
        icd10CodeId: 'code-uuid-1',
        severity: DiagnosisSeverity.MODERATE,
        diagnosisDate: new Date('2024-01-15'),
        isPrimary: true,
        isChronic: true,
      };

      const mockCode = {
        id: 'code-uuid-1',
        code: 'E11.9',
        description: 'Type 2 diabetes',
        codeType: CodeType.ICD10_CM,
        isActive: true,
      };

      const savedDiagnosis = makeDiagnosis({
        ...createDto,
        id: 'new-diagnosis-uuid',
        createdBy: undefined,
      });

      medicalCodeService.findById.mockResolvedValue(mockCode);
      diagnosisRepo.create.mockReturnValue(createDto);
      diagnosisRepo.save.mockResolvedValue(savedDiagnosis);

      await service.create(createDto);

      expect(notificationsService.emitDiagnosisCreated).toHaveBeenCalledWith(
        'provider-uuid-1',
        expect.any(String),
        expect.any(Object),
      );
    });
  });

  describe('update', () => {
    it('should emit severity_escalated notification when severity increases', async () => {
      const existingDiagnosis = makeDiagnosis({
        severity: DiagnosisSeverity.MILD,
      });

      const updateDto: UpdateDiagnosisDto = {
        severity: DiagnosisSeverity.SEVERE,
        updatedBy: 'user-uuid-2',
        changeReason: 'Patient condition worsened',
      };

      const updatedDiagnosis = makeDiagnosis({
        ...existingDiagnosis,
        severity: DiagnosisSeverity.SEVERE,
        updatedBy: 'user-uuid-2',
      });

      diagnosisRepo.findOne.mockResolvedValue(existingDiagnosis);
      historyRepo.create.mockReturnValue({});
      historyRepo.save.mockResolvedValue({});
      diagnosisRepo.save.mockResolvedValue(updatedDiagnosis);
      treatmentPlanRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      });

      const result = await service.update('diagnosis-uuid-1', updateDto);

      expect(result.severity).toBe(DiagnosisSeverity.SEVERE);
      expect(notificationsService.emitDiagnosisSeverityEscalated).toHaveBeenCalledWith(
        'user-uuid-2',
        'diagnosis-uuid-1',
        expect.objectContaining({
          patientId: 'patient-uuid-1',
          previousSeverity: DiagnosisSeverity.MILD,
          newSeverity: DiagnosisSeverity.SEVERE,
          reason: 'Patient condition worsened',
        }),
      );
    });

    it('should emit status_confirmed notification when status changes to confirmed', async () => {
      const existingDiagnosis = makeDiagnosis({
        status: DiagnosisStatus.PRELIMINARY,
      });

      const updateDto: UpdateDiagnosisDto = {
        status: DiagnosisStatus.CONFIRMED,
        updatedBy: 'user-uuid-2',
        changeReason: 'Laboratory results confirm diagnosis',
      };

      const updatedDiagnosis = makeDiagnosis({
        ...existingDiagnosis,
        status: DiagnosisStatus.CONFIRMED,
        updatedBy: 'user-uuid-2',
      });

      const mockTreatmentPlan = { id: 'plan-uuid-1' };

      diagnosisRepo.findOne.mockResolvedValue(existingDiagnosis);
      historyRepo.create.mockReturnValue({});
      historyRepo.save.mockResolvedValue({});
      diagnosisRepo.save.mockResolvedValue(updatedDiagnosis);
      treatmentPlanRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockTreatmentPlan]),
      });

      await service.update('diagnosis-uuid-1', updateDto);

      expect(notificationsService.emitDiagnosisStatusConfirmed).toHaveBeenCalledWith(
        'user-uuid-2',
        'diagnosis-uuid-1',
        expect.objectContaining({
          patientId: 'patient-uuid-1',
          severity: DiagnosisSeverity.MODERATE,
          isPrimary: true,
          treatmentPlanIds: ['plan-uuid-1'],
        }),
      );
    });

    it('should not emit notification when severity decreases', async () => {
      const existingDiagnosis = makeDiagnosis({
        severity: DiagnosisSeverity.SEVERE,
      });

      const updateDto: UpdateDiagnosisDto = {
        severity: DiagnosisSeverity.MILD,
        updatedBy: 'user-uuid-2',
      };

      const updatedDiagnosis = makeDiagnosis({
        ...existingDiagnosis,
        severity: DiagnosisSeverity.MILD,
      });

      diagnosisRepo.findOne.mockResolvedValue(existingDiagnosis);
      historyRepo.create.mockReturnValue({});
      historyRepo.save.mockResolvedValue({});
      diagnosisRepo.save.mockResolvedValue(updatedDiagnosis);
      treatmentPlanRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      });

      await service.update('diagnosis-uuid-1', updateDto);

      expect(notificationsService.emitDiagnosisSeverityEscalated).not.toHaveBeenCalled();
    });

    it('should include treatment plan IDs in notification metadata', async () => {
      const existingDiagnosis = makeDiagnosis({
        status: DiagnosisStatus.PRELIMINARY,
      });

      const updateDto: UpdateDiagnosisDto = {
        status: DiagnosisStatus.CONFIRMED,
        updatedBy: 'user-uuid-2',
      };

      const updatedDiagnosis = makeDiagnosis({
        ...existingDiagnosis,
        status: DiagnosisStatus.CONFIRMED,
      });

      const mockPlans = [
        { id: 'plan-uuid-1' },
        { id: 'plan-uuid-2' },
        { id: 'plan-uuid-3' },
      ];

      diagnosisRepo.findOne.mockResolvedValue(existingDiagnosis);
      historyRepo.create.mockReturnValue({});
      historyRepo.save.mockResolvedValue({});
      diagnosisRepo.save.mockResolvedValue(updatedDiagnosis);
      treatmentPlanRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockPlans),
      });

      await service.update('diagnosis-uuid-1', updateDto);

      expect(notificationsService.emitDiagnosisStatusConfirmed).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          treatmentPlanIds: ['plan-uuid-1', 'plan-uuid-2', 'plan-uuid-3'],
        }),
      );
    });
  });
});
