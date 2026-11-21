import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { DrugRecallService } from './drug-recall.service';
import { DrugRecall, RecallStatus, RecallClassification } from '../entities/drug-recall.entity';
import { RecallImpactReport, NotificationStatus } from '../entities/recall-impact-report.entity';
import { PharmacyInventoryService } from './pharmacy-inventory.service';
import { RecallNotificationService } from './recall-notification.service';
import { PaginationDto } from '../../common/dto/pagination.dto';

// ── Helpers ────────────────────────────────────────────────────────────────

const makeRecall = (overrides: Partial<DrugRecall> = {}): DrugRecall =>
  ({
    id: 'recall-1',
    recallNumber: 'REC-001',
    drugId: 'drug-1',
    reason: 'Contamination',
    classification: RecallClassification.CLASS_I,
    status: RecallStatus.INITIATED,
    description: 'Test recall',
    initiationDate: new Date('2026-01-01'),
    completionDate: null,
    affectedLotNumbers: ['LOT-A'],
    affectedNdcCodes: [],
    affectedInventory: [],
    actionsTaken: [],
    requiresPatientNotification: true,
    affectedPatientsCount: 0,
    fdaRecallUrl: null,
    drug: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as DrugRecall);

const makeImpactReport = (overrides: Partial<RecallImpactReport> = {}): RecallImpactReport =>
  ({
    id: 'report-1',
    recallId: 'recall-1',
    prescriptionId: 'rx-1',
    patientId: 'patient-1',
    prescriberId: 'provider-1',
    matchedNdcCode: null,
    matchedLotNumber: null,
    patientNotificationStatus: NotificationStatus.PENDING,
    patientNotifiedAt: null,
    patientNotificationError: null,
    prescriberNotificationStatus: NotificationStatus.PENDING,
    prescriberNotifiedAt: null,
    prescriberNotificationError: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    recall: null,
    ...overrides,
  } as RecallImpactReport);

// ── Tests ──────────────────────────────────────────────────────────────────

describe('DrugRecallService', () => {
  let service: DrugRecallService;

  const mockRecallRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    update: jest.fn(),
  };

  const mockImpactRepo = {
    findAndCount: jest.fn(),
  };

  const mockInventoryService: Partial<PharmacyInventoryService> = {
    getInventoryByDrug: jest.fn().mockResolvedValue([]),
    markAsRecalled: jest.fn().mockResolvedValue(undefined),
  };

  const mockNotificationService: Partial<RecallNotificationService> = {
    notifyAffectedParties: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DrugRecallService,
        { provide: getRepositoryToken(DrugRecall), useValue: mockRecallRepo },
        { provide: getRepositoryToken(RecallImpactReport), useValue: mockImpactRepo },
        { provide: PharmacyInventoryService, useValue: mockInventoryService },
        { provide: RecallNotificationService, useValue: mockNotificationService },
      ],
    }).compile();

    service = module.get<DrugRecallService>(DrugRecallService);
    jest.clearAllMocks();
  });

  // ── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('saves a new recall and triggers notifications when requiresPatientNotification=true', async () => {
      const saved = makeRecall({ requiresPatientNotification: true });
      mockRecallRepo.create.mockReturnValue(saved);
      mockRecallRepo.save.mockResolvedValue(saved);

      const result = await service.create({ drugId: 'drug-1', requiresPatientNotification: true });

      expect(mockRecallRepo.save).toHaveBeenCalledTimes(1);
      expect(result.id).toBe('recall-1');
      // Allow microtask queue to flush the fire-and-forget promise
      await Promise.resolve();
      expect(mockNotificationService.notifyAffectedParties).toHaveBeenCalledWith(saved);
    });

    it('does NOT trigger notifications when requiresPatientNotification=false', async () => {
      const saved = makeRecall({ requiresPatientNotification: false });
      mockRecallRepo.create.mockReturnValue(saved);
      mockRecallRepo.save.mockResolvedValue(saved);

      await service.create({ drugId: 'drug-1', requiresPatientNotification: false });
      await Promise.resolve();

      expect(mockNotificationService.notifyAffectedParties).not.toHaveBeenCalled();
    });
  });

  // ── findAll — pagination ───────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns paginated results with default page=1 pageSize=20', async () => {
      mockRecallRepo.findAndCount.mockResolvedValue([[makeRecall()], 1]);

      const result = await service.findAll({ page: 1, pageSize: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.pageSize).toBe(20);
      expect(result.meta.total).toBe(1);
    });

    it('passes the correct skip/take to the repository', async () => {
      mockRecallRepo.findAndCount.mockResolvedValue([[], 50]);

      await service.findAll({ page: 3, pageSize: 10 });

      expect(mockRecallRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });

    it('never returns more than 100 items per page', async () => {
      const hundred = Array.from({ length: 100 }, (_, i) => makeRecall({ id: `r-${i}` }));
      mockRecallRepo.findAndCount.mockResolvedValue([hundred, 200]);

      const result = await service.findAll({ page: 1, pageSize: 100 });

      expect(result.data.length).toBeLessThanOrEqual(100);
    });
  });

  // ── findOne ────────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('returns the recall when it exists', async () => {
      mockRecallRepo.findOne.mockResolvedValue(makeRecall());
      const result = await service.findOne('recall-1');
      expect(result.id).toBe('recall-1');
    });

    it('throws NotFoundException when recall does not exist', async () => {
      mockRecallRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });
  });

  // ── initiateRecall ─────────────────────────────────────────────────────────

  describe('initiateRecall', () => {
    it('sets status ONGOING and fires notifications', async () => {
      const recall = makeRecall({ status: RecallStatus.INITIATED });
      mockRecallRepo.findOne.mockResolvedValue(recall);
      mockRecallRepo.save.mockResolvedValue({ ...recall, status: RecallStatus.ONGOING });

      const result = await service.initiateRecall('recall-1');

      expect(result.status).toBe(RecallStatus.ONGOING);
      await Promise.resolve();
      expect(mockNotificationService.notifyAffectedParties).toHaveBeenCalled();
    });
  });

  // ── getImpactReport ────────────────────────────────────────────────────────

  describe('getImpactReport', () => {
    it('returns paginated impact reports for a recall', async () => {
      mockRecallRepo.findOne.mockResolvedValue(makeRecall());
      mockImpactRepo.findAndCount.mockResolvedValue([[makeImpactReport()], 1]);

      const result = await service.getImpactReport('recall-1', { page: 1, pageSize: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].patientId).toBe('patient-1');
      expect(result.meta.total).toBe(1);
    });

    it('throws NotFoundException when the recall does not exist', async () => {
      mockRecallRepo.findOne.mockResolvedValue(null);
      await expect(
        service.getImpactReport('missing', { page: 1, pageSize: 20 }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
