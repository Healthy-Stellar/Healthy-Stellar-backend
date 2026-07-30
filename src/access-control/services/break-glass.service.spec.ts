import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { BreakGlassService } from './break-glass.service';
import { BreakGlassAccess, BreakGlassStatus } from '../entities/break-glass-access.entity';
import { AuditLogService } from '../../common/services/audit-log.service';
import { NotificationsService } from '../../notifications/services/notifications.service';

describe('BreakGlassService', () => {
  let service: BreakGlassService;
  let repo: Repository<BreakGlassAccess>;

  const mockAccess = {
    id: 'break-1',
    granteeId: 'user-1',
    patientId: 'patient-1',
    justification: 'Emergency — patient unconscious, needs immediate critical care access.',
    clinicalContext: 'ICU',
    status: BreakGlassStatus.ACTIVE,
    expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000),
    createdAt: new Date(),
    updatedAt: new Date(),
    reviewedBy: null,
    reviewedAt: null,
    reviewNotes: null,
    reviewOutcome: null,
    sorobanTxHash: null,
  };

  const mockAuditLogService = {
    log: jest.fn().mockResolvedValue(undefined),
  };

  const mockNotificationsService = {
    sendPatientEmailNotification: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BreakGlassService,
        {
          provide: getRepositoryToken(BreakGlassAccess),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn().mockReturnValue(mockAccess),
            save: jest.fn().mockResolvedValue(mockAccess),
            update: jest.fn().mockResolvedValue({ affected: 1 }),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              if (key === 'BREAK_GLASS_TTL_MS') return 4 * 60 * 60 * 1000;
              if (key === 'BREAK_GLASS_REVIEW_SLA_MS') return 24 * 60 * 60 * 1000;
              return null;
            }),
          },
        },
        { provide: AuditLogService, useValue: mockAuditLogService },
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();

    service = module.get<BreakGlassService>(BreakGlassService);
    repo = module.get<Repository<BreakGlassAccess>>(getRepositoryToken(BreakGlassAccess));
  });

  afterEach(() => {
    jest.clearAllMocks();
    service.onModuleDestroy();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('grantBreakGlassAccess', () => {
    it('should grant break-glass access with valid justification', async () => {
      jest.spyOn(repo, 'findOne').mockResolvedValue(null);
      const result = await service.grantBreakGlassAccess(
        'user-1',
        'patient-1',
        'Emergency — patient unconscious, needs immediate critical care access.',
      );
      expect(result).toBeDefined();
      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'BREAK_GLASS_GRANTED' }),
      );
      expect(mockNotificationsService.sendPatientEmailNotification).toHaveBeenCalled();
    });

    it('should reject justification shorter than 20 characters', async () => {
      await expect(
        service.grantBreakGlassAccess('user-1', 'patient-1', 'Short'),
      ).rejects.toThrow('at least 20 characters');
    });

    it('should reject duplicate active session', async () => {
      jest.spyOn(repo, 'findOne').mockResolvedValue(mockAccess);
      await expect(
        service.grantBreakGlassAccess('user-1', 'patient-1', 'Emergency — patient unconscious, needs immediate critical care access.'),
      ).rejects.toThrow('already exists');
    });
  });

  describe('hasActiveBreakGlassAccess', () => {
    it('should return true for active unexpired access', async () => {
      jest.spyOn(repo, 'findOne').mockResolvedValue(mockAccess);
      const result = await service.hasActiveBreakGlassAccess('user-1', 'patient-1');
      expect(result).toBe(true);
    });

    it('should return false when no active access exists', async () => {
      jest.spyOn(repo, 'findOne').mockResolvedValue(null);
      const result = await service.hasActiveBreakGlassAccess('user-1', 'patient-1');
      expect(result).toBe(false);
    });
  });

  describe('reviewBreakGlassAccess', () => {
    it('should review and approve access', async () => {
      jest.spyOn(repo, 'findOne').mockResolvedValue(mockAccess);
      const result = await service.reviewBreakGlassAccess(
        'break-1',
        'reviewer-1',
        'Access reviewed — clinical need confirmed.',
        'approved',
      );
      expect(result).toBeDefined();
      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'BREAK_GLASS_REVIEWED_APPROVED' }),
      );
    });

    it('should throw on non-existent access', async () => {
      jest.spyOn(repo, 'findOne').mockResolvedValue(null);
      await expect(
        service.reviewBreakGlassAccess('nonexistent', 'reviewer-1', 'Notes', 'approved'),
      ).rejects.toThrow('not found');
    });
  });

  describe('runSweep', () => {
    it('should expire stale accesses and check SLA', async () => {
      jest.spyOn(repo, 'find').mockResolvedValue([]);
      const result = await service.runSweep();
      expect(result.expired).toBe(1);
      expect(result.slaBreaches).toBe(0);
    });
  });

  describe('getUnreviewedAccesses', () => {
    it('should return unreviewed accesses past SLA', async () => {
      jest.spyOn(repo, 'find').mockResolvedValue([mockAccess]);
      const result = await service.getUnreviewedAccesses();
      expect(result).toHaveLength(1);
    });
  });
});
