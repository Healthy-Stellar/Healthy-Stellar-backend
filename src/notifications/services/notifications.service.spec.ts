import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotificationsService, MAILER_SERVICE } from './notifications.service';
import { NotificationsGateway } from '../notifications.gateway';
import { NotificationPreferencesService } from './notification-preferences.service';
import { NotificationTemplateService } from './notification-template.service';
import { NotificationEventType } from '../interfaces/notification-event.interface';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let gateway: jest.Mocked<NotificationsGateway>;
  let preferencesService: jest.Mocked<NotificationPreferencesService>;
  let mockMailerService: { sendMail: jest.Mock };
  let templateService: jest.Mocked<NotificationTemplateService>;

  const buildModule = async (emailFlag = 'false', withMailer = false) => {
    mockMailerService = { sendMail: jest.fn().mockResolvedValue(undefined) };

    const providers: any[] = [
      NotificationsService,
      { provide: NotificationsGateway, useValue: { emitNotification: jest.fn() } },
      {
        provide: NotificationPreferencesService,
        useValue: { isChannelEnabled: jest.fn().mockResolvedValue(true) },
      },
      {
        provide: ConfigService,
        useValue: {
          get: jest.fn((key: string, def: string) =>
            key === 'ENABLE_EMAIL_NOTIFICATIONS' ? emailFlag : def,
          ),
        },
      },
    ];

    if (withMailer) {
      providers.push({ provide: MAILER_SERVICE, useValue: mockMailerService });
    }

    const module: TestingModule = await Test.createTestingModule({ providers }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    gateway = module.get(NotificationsGateway);
    preferencesService = module.get(NotificationPreferencesService);
  };

  beforeEach(() => buildModule());

  // ── Direct emit helpers ──────────────────────────────────────────────────
        {
          provide: NotificationTemplateService,
          useValue: {
            resolve: jest.fn().mockReturnValue({
              subject: 'Test subject',
              body: 'Test body',
              lang: 'en',
            }),
          },
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    gateway = module.get(NotificationsGateway);
    templateService = module.get(NotificationTemplateService);
  });

  it('should emit record accessed event', () => {
    service.emitRecordAccessed('actor-1', 'resource-1', { detail: 'test' });
    expect(gateway.emitNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: NotificationEventType.RECORD_ACCESSED,
        actorId: 'actor-1',
        resourceId: 'resource-1',
        metadata: { detail: 'test' },
      }),
    );
  });

  it('should emit access granted event', () => {
    service.emitAccessGranted('actor-1', 'resource-1');
    expect(gateway.emitNotification).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: NotificationEventType.ACCESS_GRANTED }),
    );
  });

  it('should emit access revoked event', () => {
    service.emitAccessRevoked('actor-1', 'resource-1');
    expect(gateway.emitNotification).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: NotificationEventType.ACCESS_REVOKED }),
    );
  });

  it('should emit record uploaded event', () => {
    service.emitRecordUploaded('actor-1', 'resource-1');
    expect(gateway.emitNotification).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: NotificationEventType.RECORD_UPLOADED }),
    );
  });

  // ── On-chain event → notification mapping ────────────────────────────────

  describe('notifyOnChainEvent', () => {
    it('should emit WebSocket notification for new_record on-chain event', async () => {
      await service.notifyOnChainEvent(
        NotificationEventType.RECORD_UPLOADED,
        'system',
        'record-1',
        'patient-1',
      );
      expect(gateway.emitNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: NotificationEventType.RECORD_UPLOADED,
          metadata: expect.objectContaining({ targetUserId: 'patient-1' }),
        }),
      );
    });

    it('should emit WebSocket notification for access_revoked on-chain event', async () => {
      await service.notifyOnChainEvent(
        NotificationEventType.ACCESS_REVOKED,
        'actor-1',
        'record-1',
        'patient-1',
      );
      expect(gateway.emitNotification).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: NotificationEventType.ACCESS_REVOKED }),
      );
    });

    it('should emit WebSocket notification for access_granted on-chain event', async () => {
      await service.notifyOnChainEvent(
        NotificationEventType.ACCESS_GRANTED,
        'actor-1',
        'record-1',
        'patient-1',
      );
      expect(gateway.emitNotification).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: NotificationEventType.ACCESS_GRANTED }),
      );
    });

    it('should skip WebSocket when patient preference is disabled', async () => {
      preferencesService.isChannelEnabled.mockResolvedValue(false);
      await service.notifyOnChainEvent(
        NotificationEventType.RECORD_UPLOADED,
        'system',
        'record-1',
        'patient-1',
      );
      expect(gateway.emitNotification).not.toHaveBeenCalled();
    });

    it('should not send email when feature flag is off', async () => {
      // emailEnabled=false by default in this suite — mailerService not injected
      await service.notifyOnChainEvent(
        NotificationEventType.RECORD_UPLOADED,
        'system',
        'record-1',
        'patient-1',
      );
      expect(mockMailerService.sendMail).not.toHaveBeenCalled();
    });

    it('should send email when feature flag is on and preference allows it', async () => {
      await buildModule('true', true);
      preferencesService.isChannelEnabled.mockResolvedValue(true);

      await service.notifyOnChainEvent(
        NotificationEventType.RECORD_UPLOADED,
        'system',
        'record-1',
        'patient-1',
      );

      expect(mockMailerService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'New medical record added to your account',
          template: 'record-uploaded',
        }),
      );
    });

    it('should not send email when email preference is disabled', async () => {
      await buildModule('true', true);
      preferencesService.isChannelEnabled
        .mockResolvedValueOnce(true)   // webSocket check
        .mockResolvedValueOnce(false); // email check

      await service.notifyOnChainEvent(
        NotificationEventType.RECORD_UPLOADED,
        'system',
        'record-1',
        'patient-1',
      );

      expect(mockMailerService.sendMail).not.toHaveBeenCalled();
  describe('resolveLocalizedNotification', () => {
    it('delegates to templateService.resolve', () => {
      const result = service.resolveLocalizedNotification(
        NotificationEventType.RECORD_ACCESSED,
        'fr',
        { resourceId: 'r1', actorId: 'a1' },
      );

      expect(templateService.resolve).toHaveBeenCalledWith(
        NotificationEventType.RECORD_ACCESSED,
        'fr',
        { resourceId: 'r1', actorId: 'a1' },
      );
      expect(result).toEqual({ subject: 'Test subject', body: 'Test body', lang: 'en' });
    });

    it('passes empty args by default', () => {
      service.resolveLocalizedNotification(NotificationEventType.ACCESS_GRANTED, 'ar');

      expect(templateService.resolve).toHaveBeenCalledWith(
        NotificationEventType.ACCESS_GRANTED,
        'ar',
        {},
      );
    });
  });
});
