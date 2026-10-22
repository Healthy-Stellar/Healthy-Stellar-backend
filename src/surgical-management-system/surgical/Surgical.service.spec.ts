import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SurgicalService } from './surgical.service';
import { AuditService } from '../../common/audit/audit.service';
import {
  SurgicalCase,
  OperatingRoom,
  SurgicalTeamMember,
  SurgicalEquipment,
  OperativeNote,
  SurgicalOutcome,
  RoomBooking,
  SurgicalChecklist,
  CaseStatus,
} from './entities';
import { SubmitSurgicalChecklistDto } from './dto';

// ─── Repository mock factory ──────────────────────────────────────────────────
function makeRepo(overrides: Partial<Record<string, jest.Mock>> = {}) {
  return {
    create: jest.fn((data) => data),
    save: jest.fn((data) => Promise.resolve({ id: 'generated-id', ...data })),
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    update: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(),
    ...overrides,
  };
}

describe('SurgicalService — pre-operative checklist', () => {
  let service: SurgicalService;
  let surgicalCaseRepo: ReturnType<typeof makeRepo>;
  let checklistRepo: ReturnType<typeof makeRepo>;
  let operatingRoomRepo: ReturnType<typeof makeRepo>;
  let auditService: { log: jest.Mock };

  const surgicalCase: Partial<SurgicalCase> = {
    id: 'case-1',
    status: CaseStatus.SCHEDULED,
    operatingRoomId: null,
  };

  beforeEach(async () => {
    surgicalCaseRepo = makeRepo({
      findOne: jest.fn().mockResolvedValue({ ...surgicalCase }),
    });
    checklistRepo = makeRepo();
    operatingRoomRepo = makeRepo();
    auditService = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SurgicalService,
        { provide: getRepositoryToken(SurgicalCase), useValue: surgicalCaseRepo },
        { provide: getRepositoryToken(OperatingRoom), useValue: operatingRoomRepo },
        { provide: getRepositoryToken(RoomBooking), useValue: makeRepo() },
        { provide: getRepositoryToken(SurgicalTeamMember), useValue: makeRepo() },
        { provide: getRepositoryToken(SurgicalEquipment), useValue: makeRepo() },
        { provide: getRepositoryToken(OperativeNote), useValue: makeRepo() },
        { provide: getRepositoryToken(SurgicalOutcome), useValue: makeRepo() },
        { provide: getRepositoryToken(SurgicalChecklist), useValue: checklistRepo },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get<SurgicalService>(SurgicalService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── submitChecklist ──────────────────────────────────────────────────────

  describe('submitChecklist', () => {
    it('throws NotFoundException when the surgical case does not exist', async () => {
      surgicalCaseRepo.findOne.mockResolvedValue(null);

      const dto: SubmitSurgicalChecklistDto = {
        items: [{ label: 'Site marked', completed: true }],
      };

      await expect(service.submitChecklist('missing-case', dto, 'nurse-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('creates a new checklist on first submission with item-level completedBy/completedAt', async () => {
      checklistRepo.findOne.mockResolvedValue(null);

      const dto: SubmitSurgicalChecklistDto = {
        items: [
          { label: 'Patient identity confirmed', completed: true },
          { label: 'Site marked and verified', completed: false },
        ],
      };

      const result = await service.submitChecklist('case-1', dto, 'nurse-1');

      expect(checklistRepo.create).toHaveBeenCalled();
      expect(result.items).toHaveLength(2);
      expect(result.items[0].completed).toBe(true);
      expect(result.items[0].completedBy).toBe('nurse-1');
      expect(result.items[0].completedAt).toBeInstanceOf(Date);
      expect(result.items[1].completed).toBe(false);
      expect(result.items[1].completedBy).toBeUndefined();
      expect(result.isComplete).toBe(false);
      expect(result.completedBy).toBeNull();
    });

    it('marks the checklist complete and stamps completedBy/completedAt once all items are completed', async () => {
      checklistRepo.findOne.mockResolvedValue(null);

      const dto: SubmitSurgicalChecklistDto = {
        items: [
          { label: 'Patient identity confirmed', completed: true },
          { label: 'Site marked and verified', completed: true },
        ],
      };

      const result = await service.submitChecklist('case-1', dto, 'surgeon-1');

      expect(result.isComplete).toBe(true);
      expect(result.completedBy).toBe('surgeon-1');
      expect(result.completedAt).toBeInstanceOf(Date);
    });

    it('emits an audit event only when the checklist transitions to 100% complete', async () => {
      checklistRepo.findOne.mockResolvedValue(null);

      const dto: SubmitSurgicalChecklistDto = {
        items: [{ label: 'Patient identity confirmed', completed: true }],
      };

      await service.submitChecklist('case-1', dto, 'nurse-1');

      expect(auditService.log).toHaveBeenCalledTimes(1);
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 'nurse-1',
          action: 'SURGICAL_CHECKLIST_COMPLETED',
          resourceType: 'SurgicalChecklist',
        }),
      );
    });

    it('does not emit a duplicate audit event when an already-complete checklist is resubmitted unchanged', async () => {
      const existingChecklist = {
        id: 'checklist-1',
        surgicalCaseId: 'case-1',
        items: [{ id: 'item-1', label: 'Patient identity confirmed', completed: true }],
        isComplete: true,
        completedBy: 'nurse-1',
        completedAt: new Date(),
      };
      checklistRepo.findOne.mockResolvedValue(existingChecklist);

      const dto: SubmitSurgicalChecklistDto = {
        items: [{ id: 'item-1', label: 'Patient identity confirmed', completed: true }],
      };

      await service.submitChecklist('case-1', dto, 'nurse-1');

      expect(auditService.log).not.toHaveBeenCalled();
    });

    it('does not mark an empty checklist as complete', async () => {
      checklistRepo.findOne.mockResolvedValue(null);

      const dto: SubmitSurgicalChecklistDto = { items: [] };

      const result = await service.submitChecklist('case-1', dto, 'nurse-1');

      expect(result.isComplete).toBe(false);
      expect(auditService.log).not.toHaveBeenCalled();
    });
  });

  // ─── getChecklistForCase ──────────────────────────────────────────────────

  describe('getChecklistForCase', () => {
    it('throws NotFoundException when no checklist exists for the case', async () => {
      checklistRepo.findOne.mockResolvedValue(null);

      await expect(service.getChecklistForCase('case-1')).rejects.toThrow(NotFoundException);
    });

    it('returns the checklist when found', async () => {
      const checklist = { id: 'checklist-1', surgicalCaseId: 'case-1', items: [] };
      checklistRepo.findOne.mockResolvedValue(checklist);

      const result = await service.getChecklistForCase('case-1');

      expect(result).toEqual(checklist);
    });
  });

  // ─── startSurgery gating ──────────────────────────────────────────────────

  describe('startSurgery — checklist gating', () => {
    const startDto = { actualStartTime: new Date() };

    it('throws BadRequestException when no checklist exists for the case', async () => {
      checklistRepo.findOne.mockResolvedValue(null);

      await expect(service.startSurgery('case-1', startDto as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when the checklist is incomplete', async () => {
      checklistRepo.findOne.mockResolvedValue({
        id: 'checklist-1',
        surgicalCaseId: 'case-1',
        items: [
          { id: '1', label: 'A', completed: true },
          { id: '2', label: 'B', completed: false },
        ],
        isComplete: false,
      });

      await expect(service.startSurgery('case-1', startDto as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('allows surgery to start once the checklist is 100% complete', async () => {
      checklistRepo.findOne.mockResolvedValue({
        id: 'checklist-1',
        surgicalCaseId: 'case-1',
        items: [
          { id: '1', label: 'A', completed: true },
          { id: '2', label: 'B', completed: true },
        ],
        isComplete: true,
      });

      const result = await service.startSurgery('case-1', startDto as any);

      expect(result.status).toBe(CaseStatus.IN_PROGRESS);
    });

    it('throws BadRequestException when the case is not in SCHEDULED status, before checking the checklist', async () => {
      surgicalCaseRepo.findOne.mockResolvedValue({
        ...surgicalCase,
        status: CaseStatus.IN_PROGRESS,
      });

      await expect(service.startSurgery('case-1', startDto as any)).rejects.toThrow(
        BadRequestException,
      );
      expect(checklistRepo.findOne).not.toHaveBeenCalled();
    });
  });
});
