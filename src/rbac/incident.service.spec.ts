import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IncidentService } from '../incident.service';
import {
  SecurityIncident,
  IncidentType,
  IncidentSeverity,
  IncidentStatus,
} from '../../entities/security-incident.entity';
import {
  BreachNotification,
  NotificationStatus,
} from '../../entities/breach-notification.entity';

const makeIncident = (overrides: Partial<SecurityIncident> = {}): SecurityIncident => ({
  id: 'incident-uuid-1',
  type: IncidentType.DATA_BREACH,
  severity: IncidentSeverity.HIGH,
  status: IncidentStatus.DETECTED,
  description: 'Test incident',
  affectedSystem: null,
  affectedPatientsCount: 0,
  affectedDataTypes: null,
  phiInvolved: false,
  breachNotificationRequired: false,
  hhsNotified: false,
  hhsNotificationDate: null,
  patientsNotified: false,
  patientNotificationDate: null,
  detectedAt: new Date(),
  containedAt: null,
  remediatedAt: null,
  rootCause: null,
  remediationSteps: null,
  reportedBy: null,
  assignedTo: null,
  relatedAuditLogIds: null,
  evidenceLinks: null,
  timeline: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('IncidentService', () => {
  let service: IncidentService;
  let incidentRepo: any;
  let notificationRepo: any;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IncidentService,
        {
          provide: getRepositoryToken(SecurityIncident),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            findOneOrFail: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(BreachNotification),
          useValue: {
            save: jest.fn(),
            find: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: EventEmitter2,
          useValue: { emit: jest.fn(), on: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<IncidentService>(IncidentService);
    incidentRepo = module.get(getRepositoryToken(SecurityIncident));
    notificationRepo = module.get(getRepositoryToken(BreachNotification));
    eventEmitter = module.get(EventEmitter2);

    jest.clearAllMocks();
  });

  describe('createIncident', () => {
    it('should create an incident with DETECTED status', async () => {
      const incident = makeIncident();
      incidentRepo.create.mockReturnValue(incident);
      incidentRepo.save.mockResolvedValue(incident);

      const result = await service.createIncident({
        type: IncidentType.DATA_BREACH,
        severity: IncidentSeverity.HIGH,
        description: 'Test breach',
      });

      expect(incidentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: IncidentStatus.DETECTED }),
      );
      expect(result.id).toBe(incident.id);
    });

    it('should emit incident.created event', async () => {
      const incident = makeIncident();
      incidentRepo.create.mockReturnValue(incident);
      incidentRepo.save.mockResolvedValue(incident);

      await service.createIncident({
        type: IncidentType.UNAUTHORIZED_ACCESS,
        severity: IncidentSeverity.MEDIUM,
        description: 'Unauthorized access attempt',
      });

      expect(eventEmitter.emit).toHaveBeenCalledWith('incident.created', expect.any(Object));
    });

    it('should emit incident.critical for CRITICAL severity', async () => {
      const incident = makeIncident({ severity: IncidentSeverity.CRITICAL });
      incidentRepo.create.mockReturnValue(incident);
      incidentRepo.save.mockResolvedValue(incident);

      await service.createIncident({
        type: IncidentType.RANSOMWARE,
        severity: IncidentSeverity.CRITICAL,
        description: 'Ransomware detected',
      });

      expect(eventEmitter.emit).toHaveBeenCalledWith('incident.critical', expect.any(Object));
    });

    it('should initiate breach response when PHI is involved', async () => {
      const incident = makeIncident({ phiInvolved: true, affectedPatientsCount: 10 });
      incidentRepo.create.mockReturnValue(incident);
      incidentRepo.save.mockResolvedValue(incident);
      notificationRepo.save.mockResolvedValue([]);

      await service.createIncident({
        type: IncidentType.DATA_BREACH,
        severity: IncidentSeverity.HIGH,
        description: 'PHI breach',
        phiInvolved: true,
        affectedPatientsCount: 10,
      });

      expect(notificationRepo.save).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'breach.notification.scheduled',
        expect.any(Object),
      );
    });

    it('should NOT initiate breach response when PHI not involved', async () => {
      const incident = makeIncident({ phiInvolved: false });
      incidentRepo.create.mockReturnValue(incident);
      incidentRepo.save.mockResolvedValue(incident);

      await service.createIncident({
        type: IncidentType.DENIAL_OF_SERVICE,
        severity: IncidentSeverity.MEDIUM,
        description: 'DDoS attempt',
        phiInvolved: false,
      });

      expect(notificationRepo.save).not.toHaveBeenCalled();
    });

    it('should schedule HHS notification for large breaches (500+ patients)', async () => {
      const incident = makeIncident({ phiInvolved: true, affectedPatientsCount: 600 });
      incidentRepo.create.mockReturnValue(incident);
      incidentRepo.save.mockResolvedValue(incident);
      notificationRepo.save.mockResolvedValue([]);

      await service.createIncident({
        type: IncidentType.DATA_BREACH,
        severity: IncidentSeverity.CRITICAL,
        description: 'Large breach',
        phiInvolved: true,
        affectedPatientsCount: 600,
      });

      const savedNotifications = notificationRepo.save.mock.calls[0][0] as Array<Partial<BreachNotification>>;
      const hhsNotification = savedNotifications.find(n => n.channel === 'HHS_PORTAL');
      expect(hhsNotification).toBeDefined();

      const mediaNotification = savedNotifications.find(n => n.channel === 'MEDIA');
      expect(mediaNotification).toBeDefined();
    });

    it('should set 60-day deadline for breach notifications', async () => {
      const incident = makeIncident({ phiInvolved: true, affectedPatientsCount: 5 });
      incidentRepo.create.mockReturnValue(incident);
      incidentRepo.save.mockResolvedValue(incident);
      notificationRepo.save.mockResolvedValue([]);

      const before = new Date();
      await service.createIncident({
        type: IncidentType.DATA_BREACH,
        severity: IncidentSeverity.HIGH,
        description: 'Small breach',
        phiInvolved: true,
        affectedPatientsCount: 5,
      });

      const savedNotifications = notificationRepo.save.mock.calls[0][0] as Array<Partial<BreachNotification>>;
      for (const n of savedNotifications) {
        expect(n.deadlineAt).toBeDefined();
        const days = (n.deadlineAt!.getTime() - before.getTime()) / (1000 * 60 * 60 * 24);
        expect(days).toBeCloseTo(60, 0);
      }
    });

    it('should include initial timeline entry', async () => {
      const incident = makeIncident();
      incidentRepo.create.mockReturnValue(incident);
      incidentRepo.save.mockResolvedValue(incident);

      await service.createIncident({
        type: IncidentType.POLICY_VIOLATION,
        severity: IncidentSeverity.LOW,
        description: 'Policy violation',
      });

      expect(incidentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          timeline: expect.arrayContaining([
            expect.objectContaining({ event: 'Incident detected and created' }),
          ]),
        }),
      );
    });
  });

  describe('updateIncident', () => {
    it('should update incident status and append timeline', async () => {
      const incident = makeIncident({ timeline: [{ timestamp: new Date(), event: 'Created', actor: 'SYSTEM' }] });
      incidentRepo.findOneOrFail.mockResolvedValue(incident);
      incidentRepo.save.mockResolvedValue({ ...incident, status: IncidentStatus.CONTAINED });

      const result = await service.updateIncident(
        'incident-uuid-1',
        { status: IncidentStatus.CONTAINED },
        'security-officer-1',
      );

      expect(incidentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: IncidentStatus.CONTAINED,
          timeline: expect.arrayContaining([
            expect.objectContaining({ actor: 'security-officer-1' }),
          ]),
        }),
      );
    });

    it('should set containedAt when status is CONTAINED', async () => {
      const incident = makeIncident();
      incidentRepo.findOneOrFail.mockResolvedValue(incident);
      incidentRepo.save.mockResolvedValue(incident);

      await service.updateIncident('incident-uuid-1', { status: IncidentStatus.CONTAINED }, 'actor');

      expect(incidentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ containedAt: expect.any(Date) }),
      );
    });

    it('should set remediatedAt when status is REMEDIATED', async () => {
      const incident = makeIncident();
      incidentRepo.findOneOrFail.mockResolvedValue(incident);
      incidentRepo.save.mockResolvedValue(incident);

      await service.updateIncident('incident-uuid-1', { status: IncidentStatus.REMEDIATED }, 'actor');

      expect(incidentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ remediatedAt: expect.any(Date) }),
      );
    });

    it('should emit incident.updated event', async () => {
      const incident = makeIncident();
      incidentRepo.findOneOrFail.mockResolvedValue(incident);
      incidentRepo.save.mockResolvedValue(incident);

      await service.updateIncident('incident-uuid-1', { assignedTo: 'officer-1' }, 'admin');

      expect(eventEmitter.emit).toHaveBeenCalledWith('incident.updated', expect.any(Object));
    });
  });

  describe('handleAuditAnomaly', () => {
    it('should create an incident on anomaly event', async () => {
      const createSpy = jest.spyOn(service, 'createIncident').mockResolvedValue(makeIncident());

      await service.handleAuditAnomaly({ userId: 'user-1', count: 200, windowMinutes: 60 });

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: IncidentType.UNAUTHORIZED_ACCESS,
          phiInvolved: true,
          reportedBy: 'AUTOMATED_MONITORING',
        }),
      );
    });
  });

  describe('findAll', () => {
    it('should return all incidents', async () => {
      const incidents = [makeIncident(), makeIncident({ id: 'incident-2' })];
      incidentRepo.find.mockResolvedValue(incidents);

      const result = await service.findAll();
      expect(result).toHaveLength(2);
    });

    it('should filter by status when provided', async () => {
      incidentRepo.find.mockResolvedValue([]);

      await service.findAll(IncidentStatus.INVESTIGATING);

      expect(incidentRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: IncidentStatus.INVESTIGATING } }),
      );
    });
  });

  describe('processNotifications', () => {
    it('should process pending notifications that are due', async () => {
      const notification: Partial<BreachNotification> = {
        id: 'notif-1',
        channel: 'EMAIL' as any,
        status: NotificationStatus.PENDING,
        scheduledAt: new Date(Date.now() - 1000),
        retryCount: 0,
      };
      notificationRepo.find.mockResolvedValue([notification]);
      notificationRepo.update.mockResolvedValue({});

      await service.processNotifications();

      expect(eventEmitter.emit).toHaveBeenCalledWith('notification.send', notification);
      expect(notificationRepo.update).toHaveBeenCalledWith(
        'notif-1',
        expect.objectContaining({ status: NotificationStatus.SENT }),
      );
    });

    it('should increment retryCount on failure', async () => {
      const notification: Partial<BreachNotification> = {
        id: 'notif-1',
        channel: 'EMAIL' as any,
        status: NotificationStatus.PENDING,
        scheduledAt: new Date(Date.now() - 1000),
        retryCount: 2,
      };
      notificationRepo.find.mockResolvedValue([notification]);
      eventEmitter.emit.mockImplementation((event: string) => {
        if (event === 'notification.send') throw new Error('SMTP failure');
        return true;
      });
      notificationRepo.update.mockResolvedValue({});

      await service.processNotifications();

      expect(notificationRepo.update).toHaveBeenCalledWith(
        'notif-1',
        expect.objectContaining({ retryCount: 3, errorMessage: 'SMTP failure' }),
      );
    });
  });
});
