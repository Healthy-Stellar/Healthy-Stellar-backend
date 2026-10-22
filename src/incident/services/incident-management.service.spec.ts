import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  Incident,
  IncidentPriority,
  IncidentState,
  SLA_MINUTES,
} from '../entities/incident.entity';
import { IncidentManagementService } from './incident-management.service';
import { NotificationsService } from '../../notifications/services/notifications.service';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

const mockRepo = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
});

const mockNotifications = () => ({
  sendProviderEmailNotification: jest.fn().mockResolvedValue(undefined),
});

/** Build a minimal Incident fixture with sensible defaults */
function makeIncident(overrides: Partial<Incident> = {}): Incident {
  return {
    id: 'uuid-1',
    title: 'DB unreachable',
    description: null,
    priority: IncidentPriority.P1,
    state: IncidentState.OPEN,
    assignedTo: 'on-call-1',
    firstResponseAt: null,
    resolvedAt: null,
    slaBreach: false,
    escalationLevel: 0,
    lastEscalatedAt: null,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as unknown as Incident;
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('IncidentManagementService', () => {
  let service: IncidentManagementService;
  let repo: jest.Mocked<Repository<Incident>>;
  let notifications: jest.Mocked<NotificationsService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IncidentManagementService,
        { provide: getRepositoryToken(Incident), useFactory: mockRepo },
        { provide: NotificationsService, useFactory: mockNotifications },
      ],
    }).compile();

    service = module.get(IncidentManagementService);
    repo = module.get(getRepositoryToken(Incident));
    notifications = module.get(NotificationsService);
  });

  // -------------------------------------------------------------------------
  // create
  // -------------------------------------------------------------------------

  describe('create', () => {
    it('persists a new incident with state=OPEN and returns it', async () => {
      const dto = {
        title: 'DB unreachable',
        priority: IncidentPriority.P1,
        assignedTo: 'on-call-engineer',
      };
      const entity = makeIncident({ id: 'uuid-1', ...dto });

      repo.create.mockReturnValue(entity);
      repo.save.mockResolvedValue(entity);

      const result = await service.create(dto);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          priority: IncidentPriority.P1,
          state: IncidentState.OPEN,
        }),
      );
      expect(result.id).toBe('uuid-1');
      expect(result.state).toBe(IncidentState.OPEN);
    });
  });

  // -------------------------------------------------------------------------
  // acknowledge — happy path
  // -------------------------------------------------------------------------

  describe('acknowledge', () => {
    it('transitions OPEN → ACKNOWLEDGED and sets firstResponseAt', async () => {
      const incident = makeIncident({ state: IncidentState.OPEN, firstResponseAt: null });
      repo.findOne.mockResolvedValue(incident);
      repo.save.mockImplementation(async (i) => i as Incident);

      const result = await service.acknowledge('uuid-1', { notes: 'On it' }, 'engineer-1');

      expect(result.state).toBe(IncidentState.ACKNOWLEDGED);
      expect(result.firstResponseAt).toBeDefined();
      expect(result.firstResponseAt).toBeInstanceOf(Date);
    });

    it('does not overwrite an existing firstResponseAt', async () => {
      const existingResponseAt = new Date('2024-01-01T10:00:00Z');
      const incident = makeIncident({
        state: IncidentState.OPEN,
        firstResponseAt: existingResponseAt,
      });
      repo.findOne.mockResolvedValue(incident);
      repo.save.mockImplementation(async (i) => i as Incident);

      const result = await service.acknowledge('uuid-1', {}, 'engineer-2');

      expect(result.firstResponseAt).toBe(existingResponseAt);
    });

    it('stores acknowledgeNotes and acknowledgedBy in metadata', async () => {
      const incident = makeIncident({ state: IncidentState.OPEN, metadata: { foo: 'bar' } });
      repo.findOne.mockResolvedValue(incident);
      repo.save.mockImplementation(async (i) => i as Incident);

      const result = await service.acknowledge('uuid-1', { notes: 'paging team' }, 'eng-3');

      expect(result.metadata.acknowledgeNotes).toBe('paging team');
      expect(result.metadata.acknowledgedBy).toBe('eng-3');
      expect(result.metadata.foo).toBe('bar'); // existing metadata preserved
    });
  });

  // -------------------------------------------------------------------------
  // acknowledge — invalid transitions (409)
  // -------------------------------------------------------------------------

  describe('acknowledge — invalid transitions', () => {
    it.each([
      IncidentState.ACKNOWLEDGED,
      IncidentState.RESOLVED,
      IncidentState.IN_PROGRESS,
    ])(
      'throws ConflictException (409) when trying to acknowledge a %s incident',
      async (state) => {
        repo.findOne.mockResolvedValue(makeIncident({ state }));

        await expect(
          service.acknowledge('uuid-1', {}, 'eng-1'),
        ).rejects.toBeInstanceOf(ConflictException);
      },
    );

    it('conflict message mentions the current state', async () => {
      repo.findOne.mockResolvedValue(makeIncident({ state: IncidentState.RESOLVED }));

      await expect(service.acknowledge('uuid-1', {}, 'eng')).rejects.toThrow(
        /resolved/i,
      );
    });
  });

  // -------------------------------------------------------------------------
  // resolve — happy path
  // -------------------------------------------------------------------------

  describe('resolve', () => {
    it('transitions ACKNOWLEDGED → RESOLVED and sets resolvedAt', async () => {
      const incident = makeIncident({ state: IncidentState.ACKNOWLEDGED });
      repo.findOne.mockResolvedValue(incident);
      repo.save.mockImplementation(async (i) => i as Incident);

      const result = await service.resolve('uuid-1', { notes: 'fixed' }, 'eng-1');

      expect(result.state).toBe(IncidentState.RESOLVED);
      expect(result.resolvedAt).toBeInstanceOf(Date);
    });

    it('stores resolveNotes and resolvedBy in metadata', async () => {
      const incident = makeIncident({ state: IncidentState.ACKNOWLEDGED });
      repo.findOne.mockResolvedValue(incident);
      repo.save.mockImplementation(async (i) => i as Incident);

      const result = await service.resolve('uuid-1', { notes: 'rollback applied' }, 'sre-1');

      expect(result.metadata.resolveNotes).toBe('rollback applied');
      expect(result.metadata.resolvedBy).toBe('sre-1');
    });
  });

  // -------------------------------------------------------------------------
  // resolve — invalid transitions (409)
  // -------------------------------------------------------------------------

  describe('resolve — invalid transitions', () => {
    it.each([IncidentState.OPEN, IncidentState.RESOLVED, IncidentState.IN_PROGRESS])(
      'throws ConflictException (409) when trying to resolve a %s incident',
      async (state) => {
        repo.findOne.mockResolvedValue(makeIncident({ state }));

        await expect(
          service.resolve('uuid-1', {}, 'eng-1'),
        ).rejects.toBeInstanceOf(ConflictException);
      },
    );

    it('calling resolve twice on the same incident throws 409 the second time', async () => {
      const incident = makeIncident({ state: IncidentState.ACKNOWLEDGED });
      repo.findOne.mockResolvedValue(incident);
      repo.save.mockImplementation(async (i) => i as Incident);

      // First call succeeds
      await service.resolve('uuid-1', {}, 'eng-1');

      // Simulate the saved state being RESOLVED now
      incident.state = IncidentState.RESOLVED;

      await expect(
        service.resolve('uuid-1', {}, 'eng-1'),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  // -------------------------------------------------------------------------
  // reopen — happy path
  // -------------------------------------------------------------------------

  describe('reopen', () => {
    it('transitions RESOLVED → OPEN and clears resolvedAt', async () => {
      const incident = makeIncident({
        state: IncidentState.RESOLVED,
        resolvedAt: new Date(),
        slaBreach: true,
        escalationLevel: 2,
        lastEscalatedAt: new Date(),
      });
      repo.findOne.mockResolvedValue(incident);
      repo.save.mockImplementation(async (i) => i as Incident);

      const result = await service.reopen('uuid-1', { notes: 'regression found' }, 'eng-1');

      expect(result.state).toBe(IncidentState.OPEN);
      expect(result.resolvedAt).toBeNull();
    });

    it('resets SLA tracking fields on reopen', async () => {
      const incident = makeIncident({
        state: IncidentState.RESOLVED,
        resolvedAt: new Date(),
        slaBreach: true,
        escalationLevel: 3,
        lastEscalatedAt: new Date(),
      });
      repo.findOne.mockResolvedValue(incident);
      repo.save.mockImplementation(async (i) => i as Incident);

      const result = await service.reopen('uuid-1', {}, 'eng-1');

      expect(result.slaBreach).toBe(false);
      expect(result.escalationLevel).toBe(0);
      expect(result.lastEscalatedAt).toBeNull();
    });

    it('stores reopenNotes and reopenedBy in metadata', async () => {
      const incident = makeIncident({ state: IncidentState.RESOLVED, resolvedAt: new Date() });
      repo.findOne.mockResolvedValue(incident);
      repo.save.mockImplementation(async (i) => i as Incident);

      const result = await service.reopen('uuid-1', { notes: 'still broken' }, 'pm-1');

      expect(result.metadata.reopenNotes).toBe('still broken');
      expect(result.metadata.reopenedBy).toBe('pm-1');
    });
  });

  // -------------------------------------------------------------------------
  // reopen — invalid transitions (409)
  // -------------------------------------------------------------------------

  describe('reopen — invalid transitions', () => {
    it.each([IncidentState.OPEN, IncidentState.ACKNOWLEDGED, IncidentState.IN_PROGRESS])(
      'throws ConflictException (409) when trying to reopen a %s incident',
      async (state) => {
        repo.findOne.mockResolvedValue(makeIncident({ state }));

        await expect(
          service.reopen('uuid-1', {}, 'eng-1'),
        ).rejects.toBeInstanceOf(ConflictException);
      },
    );
  });

  // -------------------------------------------------------------------------
  // Full lifecycle happy path
  // -------------------------------------------------------------------------

  describe('full lifecycle: OPEN → ACKNOWLEDGED → RESOLVED → OPEN (reopen)', () => {
    it('completes a full round-trip without errors', async () => {
      const incident = makeIncident({ state: IncidentState.OPEN });
      repo.save.mockImplementation(async (i) => i as Incident);

      // OPEN → ACKNOWLEDGED
      repo.findOne.mockResolvedValue(incident);
      await service.acknowledge('uuid-1', { notes: 'ack' }, 'eng');
      expect(incident.state).toBe(IncidentState.ACKNOWLEDGED);

      // ACKNOWLEDGED → RESOLVED
      repo.findOne.mockResolvedValue(incident);
      await service.resolve('uuid-1', { notes: 'fixed' }, 'eng');
      expect(incident.state).toBe(IncidentState.RESOLVED);
      expect(incident.resolvedAt).toBeInstanceOf(Date);

      // RESOLVED → OPEN (reopen)
      repo.findOne.mockResolvedValue(incident);
      await service.reopen('uuid-1', { notes: 'regression' }, 'eng');
      expect(incident.state).toBe(IncidentState.OPEN);
      expect(incident.resolvedAt).toBeNull();
      expect(incident.slaBreach).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // findOneOrFail
  // -------------------------------------------------------------------------

  describe('findOneOrFail', () => {
    it('throws NotFoundException when incident does not exist', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findOneOrFail('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('returns the incident when it exists', async () => {
      const incident = makeIncident();
      repo.findOne.mockResolvedValue(incident);
      const result = await service.findOneOrFail('uuid-1');
      expect(result).toBe(incident);
    });
  });

  // -------------------------------------------------------------------------
  // checkAndEscalateSlaBreaches
  // -------------------------------------------------------------------------

  describe('checkAndEscalateSlaBreaches', () => {
    it('flags a P1 incident as breached after SLA window and sends notification', async () => {
      const slaMs = SLA_MINUTES[IncidentPriority.P1] * 60 * 1000;
      const createdAt = new Date(Date.now() - slaMs - 60_000); // 1 min past SLA

      const incident = makeIncident({
        state: IncidentState.OPEN,
        slaBreach: false,
        escalationLevel: 0,
        lastEscalatedAt: null,
        createdAt,
      });

      repo.find.mockResolvedValue([incident]);
      repo.save.mockImplementation(async (i) => i as Incident);

      await service.checkAndEscalateSlaBreaches();

      expect(incident.slaBreach).toBe(true);
      expect(incident.escalationLevel).toBe(1);
      expect(notifications.sendProviderEmailNotification).toHaveBeenCalledWith(
        'on-call-1',
        expect.stringContaining('SLA Breach'),
        expect.stringContaining('P1'),
      );
    });

    it('does NOT flag an incident that is still within its SLA window', async () => {
      const createdAt = new Date(Date.now() - 5 * 60 * 1000); // 5 min ago, P1 SLA=15min
      const incident = makeIncident({ state: IncidentState.OPEN, createdAt });

      repo.find.mockResolvedValue([incident]);

      await service.checkAndEscalateSlaBreaches();

      expect(incident.slaBreach).toBe(false);
      expect(notifications.sendProviderEmailNotification).not.toHaveBeenCalled();
    });

    it('escalates to a higher level when already breached', async () => {
      const slaMs = SLA_MINUTES[IncidentPriority.P1] * 60 * 1000;
      // 3× the SLA window → should trigger level 2 escalation
      const createdAt = new Date(Date.now() - slaMs * 3 - 60_000);

      const incident = makeIncident({
        state: IncidentState.OPEN,
        slaBreach: true,
        escalationLevel: 1,
        lastEscalatedAt: new Date(Date.now() - slaMs - 60_000),
        createdAt,
      });

      repo.find.mockResolvedValue([incident]);
      repo.save.mockImplementation(async (i) => i as Incident);

      await service.checkAndEscalateSlaBreaches();

      expect(incident.escalationLevel).toBe(2);
    });
  });

  // -------------------------------------------------------------------------
  // getSlaReport
  // -------------------------------------------------------------------------

  describe('getSlaReport', () => {
    it('returns per-priority breakdown within date range', async () => {
      const now = new Date();
      const p1 = makeIncident({
        priority: IncidentPriority.P1,
        slaBreach: false,
        createdAt: now,
        firstResponseAt: new Date(now.getTime() + 10 * 60_000),
      });

      repo.find.mockResolvedValue([p1]);

      const result = await service.getSlaReport({
        from: new Date(Date.now() - 86400000).toISOString(),
        to: new Date().toISOString(),
      });

      expect(result.totalIncidents).toBe(1);
      expect(result.byPriority[IncidentPriority.P1].total).toBe(1);
      expect(result.byPriority[IncidentPriority.P1].breached).toBe(0);
      expect(result.byPriority[IncidentPriority.P1].avgResponseMinutes).toBe(10);
    });

    it('counts breached incidents correctly', async () => {
      const now = new Date();
      const p2Breached = makeIncident({
        priority: IncidentPriority.P2,
        slaBreach: true,
        createdAt: now,
        firstResponseAt: null,
      });

      repo.find.mockResolvedValue([p2Breached]);

      const result = await service.getSlaReport({
        from: new Date(Date.now() - 86400000).toISOString(),
        to: new Date().toISOString(),
      });

      expect(result.byPriority[IncidentPriority.P2].breached).toBe(1);
      expect(result.byPriority[IncidentPriority.P2].compliant).toBe(0);
    });
  });
});
