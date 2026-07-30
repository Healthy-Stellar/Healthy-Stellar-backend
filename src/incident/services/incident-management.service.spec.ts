import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import {
  Incident,
  IncidentPriority,
  IncidentState,
  SLA_MINUTES,
} from '../entities/incident.entity';
import { IncidentManagementService } from './incident-management.service';
import { NotificationsService } from '../../notifications/services/notifications.service';

const mockRepo = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
});

const mockNotifications = () => ({
  sendProviderEmailNotification: jest.fn().mockResolvedValue(undefined),
});

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

  describe('create', () => {
    it('persists a new incident and returns it', async () => {
      const dto = {
        title: 'DB unreachable',
        priority: IncidentPriority.P1,
        assignedTo: 'on-call-engineer',
      };
      const entity = {
        id: 'uuid-1',
        ...dto,
        state: IncidentState.OPEN,
        slaBreach: false,
        escalationLevel: 0,
        createdAt: new Date(),
      } as Incident;

      repo.create.mockReturnValue(entity);
      repo.save.mockResolvedValue(entity);

      const result = await service.create(dto);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ priority: IncidentPriority.P1 }),
      );
      expect(result.id).toBe('uuid-1');
    });
  });

  describe('acknowledge', () => {
    it('sets firstResponseAt and transitions state to acknowledged', async () => {
      const incident = {
        id: 'uuid-1',
        title: 'DB unreachable',
        priority: IncidentPriority.P1,
        state: IncidentState.OPEN,
        firstResponseAt: null,
        slaBreach: false,
        escalationLevel: 0,
        createdAt: new Date(),
        metadata: {},
      } as unknown as Incident;

      repo.findOne.mockResolvedValue(incident);
      repo.save.mockImplementation(async (i) => i as Incident);

      const result = await service.acknowledge('uuid-1', { notes: 'On it' }, 'engineer-1');

      expect(result.firstResponseAt).toBeDefined();
      expect(result.state).toBe(IncidentState.ACKNOWLEDGED);
    });
  });

  describe('findOneOrFail', () => {
    it('throws NotFoundException when incident does not exist', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findOneOrFail('missing')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('checkAndEscalateSlaBreaches', () => {
    it('flags a P1 incident as breached after SLA window and sends notification', async () => {
      const slaMs = SLA_MINUTES[IncidentPriority.P1] * 60 * 1000;
      const createdAt = new Date(Date.now() - slaMs - 60_000); // 1 minute past SLA

      const incident = {
        id: 'uuid-p1',
        title: 'Critical outage',
        priority: IncidentPriority.P1,
        state: IncidentState.OPEN,
        slaBreach: false,
        escalationLevel: 0,
        lastEscalatedAt: null,
        assignedTo: 'on-call-1',
        createdAt,
        metadata: {},
      } as unknown as Incident;

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

      const incident = {
        id: 'uuid-ok',
        priority: IncidentPriority.P1,
        state: IncidentState.OPEN,
        slaBreach: false,
        escalationLevel: 0,
        createdAt,
      } as unknown as Incident;

      repo.find.mockResolvedValue([incident]);

      await service.checkAndEscalateSlaBreaches();

      expect(incident.slaBreach).toBe(false);
      expect(notifications.sendProviderEmailNotification).not.toHaveBeenCalled();
    });
  });

  describe('getSlaReport', () => {
    it('returns per-priority breakdown within date range', async () => {
      const now = new Date();
      const p1 = {
        priority: IncidentPriority.P1,
        slaBreach: false,
        createdAt: now,
        firstResponseAt: new Date(now.getTime() + 10 * 60_000),
      } as Incident;

      repo.find.mockResolvedValue([p1]);

      const result = await service.getSlaReport({
        from: new Date(Date.now() - 86400000).toISOString(),
        to: new Date().toISOString(),
      });

      expect(result.totalIncidents).toBe(1);
      expect(result.byPriority[IncidentPriority.P1].total).toBe(1);
      expect(result.byPriority[IncidentPriority.P1].breached).toBe(0);
    });
  });
});
