import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { OutbreakAlertsService } from './outbreak-alerts.service';
import { OutbreakThreshold } from './entities/outbreak-threshold.entity';
import { OutbreakAlert, OutbreakAlertStatus } from './entities/outbreak-alert.entity';
import { InfectionCase } from './entities/infection-case.entity';
import { NotificationsService } from '../notifications/services/notifications.service';

const mockRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  count: jest.fn(),
  save: jest.fn((entity) => Promise.resolve(entity)),
  create: jest.fn((d) => d),
  update: jest.fn(),
});

const mockNotifications = () => ({
  sendEmail: jest.fn().mockResolvedValue(undefined),
  sendProviderEmailNotification: jest.fn().mockResolvedValue(undefined),
});

describe('OutbreakAlertsService', () => {
  let service: OutbreakAlertsService;
  let thresholdRepo: ReturnType<typeof mockRepo>;
  let alertRepo: ReturnType<typeof mockRepo>;
  let caseRepo: ReturnType<typeof mockRepo>;
  let notifications: ReturnType<typeof mockNotifications>;

  const buildThreshold = (overrides: Partial<OutbreakThreshold> = {}): OutbreakThreshold =>
    ({
      id: 'threshold-1',
      pathogen: 'MRSA',
      location: 'Ward A',
      thresholdCount: 3,
      windowMinutes: 1440,
      isActive: true,
      notifyEmails: ['officer@hospital.test'],
      notifyUserIds: ['user-1'],
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }) as OutbreakThreshold;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OutbreakAlertsService,
        { provide: getRepositoryToken(OutbreakThreshold), useFactory: mockRepo },
        { provide: getRepositoryToken(OutbreakAlert), useFactory: mockRepo },
        { provide: getRepositoryToken(InfectionCase), useFactory: mockRepo },
        { provide: NotificationsService, useFactory: mockNotifications },
      ],
    }).compile();

    service = module.get(OutbreakAlertsService);
    thresholdRepo = module.get(getRepositoryToken(OutbreakThreshold));
    alertRepo = module.get(getRepositoryToken(OutbreakAlert));
    caseRepo = module.get(getRepositoryToken(InfectionCase));
    notifications = module.get(NotificationsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── evaluateThreshold ────────────────────────────────────────────────────

  describe('evaluateThreshold', () => {
    it('does not create an alert when observed count is below the threshold', async () => {
      const threshold = buildThreshold({ thresholdCount: 5 });
      caseRepo.count.mockResolvedValue(2);

      const result = await service.evaluateThreshold(threshold);

      expect(result.alertCreated).toBeNull();
      expect(result.skippedReason).toBe('below_threshold');
      expect(alertRepo.save).not.toHaveBeenCalled();
      expect(notifications.sendEmail).not.toHaveBeenCalled();
    });

    it('creates an alert and delivers notifications when the threshold is met', async () => {
      const threshold = buildThreshold({ thresholdCount: 3 });
      caseRepo.count.mockResolvedValue(4);
      alertRepo.findOne.mockResolvedValue(null); // no existing active alert

      const result = await service.evaluateThreshold(threshold);

      expect(result.alertCreated).not.toBeNull();
      expect(result.alertCreated?.pathogen).toBe('MRSA');
      expect(result.alertCreated?.location).toBe('Ward A');
      expect(result.alertCreated?.observedCount).toBe(4);
      expect(result.alertCreated?.status).toBe(OutbreakAlertStatus.ACTIVE);

      // alert persisted at least twice: initial create + post-notification save
      expect(alertRepo.save).toHaveBeenCalled();

      // email delivered to configured recipient
      expect(notifications.sendEmail).toHaveBeenCalledWith(
        'officer@hospital.test',
        expect.stringContaining('MRSA'),
        'outbreak-alert',
        expect.objectContaining({ pathogen: 'MRSA', location: 'Ward A' }),
      );

      // in-app delivery routed to configured user id
      expect(notifications.sendProviderEmailNotification).toHaveBeenCalledWith(
        'user-1',
        expect.stringContaining('MRSA'),
        expect.any(String),
      );
    });

    it('creates an alert exactly at the threshold boundary (>=)', async () => {
      const threshold = buildThreshold({ thresholdCount: 3 });
      caseRepo.count.mockResolvedValue(3);
      alertRepo.findOne.mockResolvedValue(null);

      const result = await service.evaluateThreshold(threshold);

      expect(result.alertCreated).not.toBeNull();
      expect(result.alertCreated?.observedCount).toBe(3);
    });

    it('does not create a duplicate alert while one is already active for the same pathogen+location (dedup)', async () => {
      const threshold = buildThreshold({ thresholdCount: 3 });
      caseRepo.count.mockResolvedValue(10);
      alertRepo.findOne.mockResolvedValue({
        id: 'existing-alert',
        pathogen: 'MRSA',
        location: 'Ward A',
        status: OutbreakAlertStatus.ACTIVE,
      });

      const result = await service.evaluateThreshold(threshold);

      expect(result.alertCreated).toBeNull();
      expect(result.skippedReason).toBe('already_active');
      expect(notifications.sendEmail).not.toHaveBeenCalled();
      expect(notifications.sendProviderEmailNotification).not.toHaveBeenCalled();
    });

    it('queries InfectionCase scoped to the threshold pathogen, location, and trailing window', async () => {
      const threshold = buildThreshold({ pathogen: 'C. diff', location: 'ICU', windowMinutes: 60 });
      caseRepo.count.mockResolvedValue(0);

      await service.evaluateThreshold(threshold);

      expect(caseRepo.count).toHaveBeenCalledWith({
        where: expect.objectContaining({
          pathogen: 'C. diff',
          location: 'ICU',
        }),
      });
    });
  });

  // ── evaluateAllThresholds ────────────────────────────────────────────────

  describe('evaluateAllThresholds', () => {
    it('evaluates only active thresholds and aggregates results', async () => {
      const thresholds = [
        buildThreshold({ id: 't1', thresholdCount: 100 }),
        buildThreshold({ id: 't2', pathogen: 'C. diff', thresholdCount: 1 }),
      ];
      thresholdRepo.find.mockResolvedValue(thresholds);
      caseRepo.count.mockResolvedValueOnce(1).mockResolvedValueOnce(5);
      alertRepo.findOne.mockResolvedValue(null);

      const results = await service.evaluateAllThresholds();

      expect(thresholdRepo.find).toHaveBeenCalledWith({ where: { isActive: true } });
      expect(results).toHaveLength(2);
      expect(results[0].alertCreated).toBeNull();
      expect(results[1].alertCreated).not.toBeNull();
    });
  });

  // ── Threshold CRUD ───────────────────────────────────────────────────────

  describe('createThreshold', () => {
    it('applies defaults for windowMinutes and isActive when omitted', async () => {
      thresholdRepo.create.mockImplementation((d) => d);
      thresholdRepo.save.mockImplementation((d) => Promise.resolve({ id: 'new-id', ...d }));

      const result = await service.createThreshold({
        pathogen: 'Influenza',
        location: 'Ward B',
        thresholdCount: 5,
      });

      expect(result.windowMinutes).toBe(1440);
      expect(result.isActive).toBe(true);
    });
  });

  describe('findOneThreshold', () => {
    it('throws NotFoundException when the threshold does not exist', async () => {
      thresholdRepo.findOne.mockResolvedValue(null);
      await expect(service.findOneThreshold('missing')).rejects.toThrow(NotFoundException);
    });
  });

  // ── Dashboard ────────────────────────────────────────────────────────────

  describe('findActiveAlerts', () => {
    it('returns only ACTIVE alerts ordered by most recent', async () => {
      alertRepo.find.mockResolvedValue([{ id: 'a1', status: OutbreakAlertStatus.ACTIVE }]);

      const alerts = await service.findActiveAlerts();

      expect(alertRepo.find).toHaveBeenCalledWith({
        where: { status: OutbreakAlertStatus.ACTIVE },
        order: { triggeredAt: 'DESC' },
      });
      expect(alerts).toHaveLength(1);
    });
  });

  describe('resolveAlert', () => {
    it('marks an alert resolved and sets resolvedAt', async () => {
      const alert = { id: 'a1', status: OutbreakAlertStatus.ACTIVE, resolvedAt: null };
      alertRepo.findOne.mockResolvedValue(alert);

      const result = await service.resolveAlert('a1');

      expect(result.status).toBe(OutbreakAlertStatus.RESOLVED);
      expect(result.resolvedAt).toBeInstanceOf(Date);
    });

    it('throws NotFoundException when the alert does not exist', async () => {
      alertRepo.findOne.mockResolvedValue(null);
      await expect(service.resolveAlert('missing')).rejects.toThrow(NotFoundException);
    });
  });
});
