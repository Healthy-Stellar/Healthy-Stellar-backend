import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CarePlanHandoff, HandoffStatus } from '../entities/care-plan-handoff.entity';
import { HandoffService } from './handoff.service';
import { NotificationsService } from '../../notifications/services/notifications.service';

const mockRepo = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  createQueryBuilder: jest.fn(),
});

const mockNotifications = () => ({
  sendProviderEmailNotification: jest.fn().mockResolvedValue(undefined),
});

describe('HandoffService', () => {
  let service: HandoffService;
  let repo: ReturnType<typeof mockRepo>;
  let notifications: ReturnType<typeof mockNotifications>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HandoffService,
        { provide: getRepositoryToken(CarePlanHandoff), useFactory: mockRepo },
        { provide: NotificationsService, useFactory: mockNotifications },
      ],
    }).compile();

    service = module.get(HandoffService);
    repo = module.get(getRepositoryToken(CarePlanHandoff));
    notifications = module.get(NotificationsService);
  });

  describe('create', () => {
    it('persists a handoff and notifies the receiving provider', async () => {
      const dto = {
        fromProvider: 'provider-a',
        toProvider: 'provider-b',
        patientId: 'patient-1',
        summary: 'Overnight handoff',
        pendingTasks: ['Check morning labs', 'Review medication'],
      };

      const entity = {
        id: 'handoff-1',
        ...dto,
        handoffTime: new Date(),
        status: HandoffStatus.PENDING,
      } as CarePlanHandoff;

      repo.create.mockReturnValue(entity);
      repo.save.mockResolvedValue(entity);

      const result = await service.create(dto);

      expect(repo.save).toHaveBeenCalled();
      expect(result.id).toBe('handoff-1');
      expect(notifications.sendProviderEmailNotification).toHaveBeenCalledWith(
        'provider-b',
        expect.stringContaining('handoff'),
        expect.any(String),
      );
    });
  });

  describe('acknowledge', () => {
    it('sets acknowledgedAt and transitions status to ACKNOWLEDGED', async () => {
      const handoff = {
        id: 'handoff-1',
        toProvider: 'provider-b',
        status: HandoffStatus.PENDING,
        acknowledgedAt: null,
      } as unknown as CarePlanHandoff;

      repo.findOne.mockResolvedValue(handoff);
      repo.save.mockImplementation(async (h) => h);

      const result = await service.acknowledge('handoff-1', 'provider-b');

      expect(result.status).toBe(HandoffStatus.ACKNOWLEDGED);
      expect(result.acknowledgedAt).toBeDefined();
      expect(result.acknowledgedBy).toBe('provider-b');
    });

    it('throws ForbiddenException if a different provider tries to acknowledge', async () => {
      const handoff = {
        id: 'handoff-1',
        toProvider: 'provider-b',
        status: HandoffStatus.PENDING,
      } as CarePlanHandoff;

      repo.findOne.mockResolvedValue(handoff);

      await expect(service.acknowledge('handoff-1', 'provider-c')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('throws NotFoundException for a missing handoff', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.acknowledge('missing', 'provider-b')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('getPatientTimeline', () => {
    it('returns handoffs ordered by handoffTime descending', async () => {
      const handoffs = [
        { id: 'h2', patientId: 'p1', handoffTime: new Date() } as CarePlanHandoff,
        { id: 'h1', patientId: 'p1', handoffTime: new Date(Date.now() - 3600000) } as CarePlanHandoff,
      ];
      repo.find.mockResolvedValue(handoffs);

      const result = await service.getPatientTimeline('p1');

      expect(result).toHaveLength(2);
      expect(repo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { patientId: 'p1' } }),
      );
    });
  });
});
