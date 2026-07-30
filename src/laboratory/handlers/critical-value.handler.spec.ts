import { Test, TestingModule } from '@nestjs/testing';
import { CriticalValueEventHandler } from './critical-value.handler';
import { CriticalAlertsService } from '../services/critical-alerts.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { CriticalValueDetectedEvent } from '../events/critical-value-detected.event';
import { AlertStatus, NotificationMethod } from '../entities/critical-value-alert.entity';

const mockAlert = (overrides: Partial<any> = {}) => ({
  id: 'alert-1',
  notifiedTo: 'provider-1',
  status: AlertStatus.NOTIFIED,
  notificationDate: new Date(Date.now() - 20 * 60 * 1000), // 20 min ago
  notificationLog: [],
  ...overrides,
});

describe('CriticalValueEventHandler', () => {
  let handler: CriticalValueEventHandler;
  let alertsService: jest.Mocked<CriticalAlertsService>;
  let notificationsService: jest.Mocked<NotificationsService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CriticalValueEventHandler,
        {
          provide: CriticalAlertsService,
          useValue: {
            notifyProvider: jest.fn().mockResolvedValue(undefined),
            findPendingEscalation: jest.fn().mockResolvedValue([]),
            escalate: jest.fn().mockResolvedValue(mockAlert({ status: AlertStatus.ESCALATED })),
          },
        },
        {
          provide: NotificationsService,
          useValue: { emitRecordAmended: jest.fn() },
        },
      ],
    }).compile();

    handler = module.get(CriticalValueEventHandler);
    alertsService = module.get(CriticalAlertsService);
    notificationsService = module.get(NotificationsService);
  });

  describe('handleCriticalValueDetected', () => {
    it('notifies the provider when a critical value event is received', async () => {
      const event = new CriticalValueDetectedEvent(
        'alert-1', 'rv-1', 'provider-1', 'Potassium', 6.8, 'mEq/L', 'patient-1',
      );

      await handler.handleCriticalValueDetected(event);

      expect(alertsService.notifyProvider).toHaveBeenCalledWith(
        'alert-1', 'Potassium', 6.8, 'mEq/L', 'patient-1',
      );
    });
  });

  describe('escalateUnacknowledgedAlerts', () => {
    it('does nothing when no alerts are overdue', async () => {
      alertsService.findPendingEscalation.mockResolvedValue([]);

      await handler.escalateUnacknowledgedAlerts();

      expect(alertsService.escalate).not.toHaveBeenCalled();
      expect(notificationsService.emitRecordAmended).not.toHaveBeenCalled();
    });

    it('escalates overdue alerts and emits escalation notification', async () => {
      const overdueAlert = mockAlert();
      alertsService.findPendingEscalation.mockResolvedValue([overdueAlert]);

      await handler.escalateUnacknowledgedAlerts();

      expect(alertsService.escalate).toHaveBeenCalledWith(
        'alert-1', 'system', 'No acknowledgment within 15 minutes',
      );
      expect(notificationsService.emitRecordAmended).toHaveBeenCalledWith(
        'system',
        'alert-1',
        expect.objectContaining({
          type: 'critical_value_escalation',
          originalProviderId: 'provider-1',
        }),
      );
    });

    it('escalates multiple overdue alerts independently', async () => {
      const alerts = [mockAlert({ id: 'alert-1' }), mockAlert({ id: 'alert-2', notifiedTo: 'provider-2' })];
      alertsService.findPendingEscalation.mockResolvedValue(alerts);

      await handler.escalateUnacknowledgedAlerts();

      expect(alertsService.escalate).toHaveBeenCalledTimes(2);
      expect(notificationsService.emitRecordAmended).toHaveBeenCalledTimes(2);
    });
  });
});
