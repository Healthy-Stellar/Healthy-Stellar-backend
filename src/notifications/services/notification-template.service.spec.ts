import { Test, TestingModule } from '@nestjs/testing';
import { NotificationTemplateService } from './notification-template.service';
import { NotificationEventType } from '../interfaces/notification-event.interface';
import { I18nService } from 'nestjs-i18n';

const enTemplates: Record<string, Record<string, string>> = {
  'notifications.record_accessed.subject': { en: 'Your medical record was accessed' },
  'notifications.record_accessed.body': {
    en: 'Your medical record (ID: {resourceId}) was accessed by {actorId} on {timestamp}.',
  },
  'notifications.access_granted.subject': { en: 'Access granted to your record' },
  'notifications.access_granted.body': {
    en: 'Access to your medical record (ID: {resourceId}) has been granted to {actorId}.',
  },
  'notifications.access_revoked.subject': { en: 'Access revoked from your record' },
  'notifications.access_revoked.body': {
    en: 'Access to your medical record (ID: {resourceId}) has been revoked from {actorId}.',
  },
  'notifications.record_uploaded.subject': { en: 'New medical record uploaded' },
  'notifications.record_uploaded.body': {
    en: 'A new medical record (ID: {resourceId}) has been uploaded by {actorId}.',
  },
  'notifications.emergency_access.subject': { en: 'Emergency access to your record' },
  'notifications.emergency_access.body': {
    en: 'Emergency access to your medical record (ID: {resourceId}) was initiated by {actorId} on {timestamp}.',
  },
};

const frTemplates: Record<string, Record<string, string>> = {
  'notifications.record_accessed.subject': { fr: 'Votre dossier médical a été consulté' },
  'notifications.record_accessed.body': {
    fr: 'Votre dossier médical (ID : {resourceId}) a été consulté par {actorId} le {timestamp}.',
  },
};

const arTemplates: Record<string, Record<string, string>> = {
  'notifications.record_accessed.subject': { ar: 'تم الوصول إلى سجلك الطبي' },
  'notifications.record_accessed.body': {
    ar: 'تم الوصول إلى سجلك الطبي (المعرف: {resourceId}) بواسطة {actorId} في {timestamp}.',
  },
};

function buildMockI18n(missingKeys: string[] = []) {
  return {
    translate: jest.fn((key: string, options: { lang: string }) => {
      const { lang } = options;
      if (missingKeys.includes(`${key}:${lang}`)) {
        return key; // nestjs-i18n returns the key when not found
      }
      const langMap =
        lang === 'fr' ? frTemplates : lang === 'ar' ? arTemplates : enTemplates;
      return langMap[key]?.[lang] ?? enTemplates[key]?.['en'] ?? key;
    }),
  };
}

describe('NotificationTemplateService', () => {
  let service: NotificationTemplateService;
  let mockI18n: ReturnType<typeof buildMockI18n>;

  async function createService(missingKeys: string[] = []) {
    mockI18n = buildMockI18n(missingKeys);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationTemplateService,
        { provide: I18nService, useValue: mockI18n },
      ],
    }).compile();
    service = module.get<NotificationTemplateService>(NotificationTemplateService);
  }

  beforeEach(async () => {
    await createService();
  });

  describe('language resolution', () => {
    it('resolves English template', () => {
      const result = service.resolve(NotificationEventType.RECORD_ACCESSED, 'en', {
        resourceId: 'r1',
        actorId: 'a1',
        timestamp: '2026-01-01',
      });
      expect(result.lang).toBe('en');
      expect(result.subject).toBe('Your medical record was accessed');
    });

    it('resolves French template', () => {
      const result = service.resolve(NotificationEventType.RECORD_ACCESSED, 'fr', {
        resourceId: 'r1',
        actorId: 'a1',
        timestamp: '2026-01-01',
      });
      expect(result.lang).toBe('fr');
      expect(result.subject).toBe('Votre dossier médical a été consulté');
    });

    it('resolves Arabic template', () => {
      const result = service.resolve(NotificationEventType.RECORD_ACCESSED, 'ar', {
        resourceId: 'r1',
        actorId: 'a1',
        timestamp: '2026-01-01',
      });
      expect(result.lang).toBe('ar');
      expect(result.subject).toBe('تم الوصول إلى سجلك الطبي');
    });

    it('resolves all supported event types in English', () => {
      const events = [
        NotificationEventType.RECORD_ACCESSED,
        NotificationEventType.ACCESS_GRANTED,
        NotificationEventType.ACCESS_REVOKED,
        NotificationEventType.RECORD_UPLOADED,
        NotificationEventType.EMERGENCY_ACCESS,
      ];
      for (const eventType of events) {
        const result = service.resolve(eventType, 'en', { resourceId: 'r1', actorId: 'a1' });
        expect(result.subject).not.toBe('');
        expect(result.body).not.toBe('');
      }
    });
  });

  describe('fallback behavior', () => {
    it('falls back to English for unsupported language', () => {
      const result = service.resolve(NotificationEventType.RECORD_ACCESSED, 'es', {
        resourceId: 'r1',
        actorId: 'a1',
      });
      expect(result.lang).toBe('en');
      expect(result.subject).toBe('Your medical record was accessed');
    });

    it('falls back to English for empty language string', () => {
      const result = service.resolve(NotificationEventType.RECORD_ACCESSED, '', {});
      expect(result.lang).toBe('en');
    });

    it('falls back to English when French translation key is missing', async () => {
      await createService(['notifications.access_granted.subject:fr']);
      const result = service.resolve(NotificationEventType.ACCESS_GRANTED, 'fr', {
        resourceId: 'r1',
        actorId: 'a1',
      });
      // subject falls back to English
      expect(result.subject).toBe('Access granted to your record');
    });

    it('returns key as last resort when all translations missing', async () => {
      await createService([
        'notifications.access_granted.subject:fr',
        'notifications.access_granted.subject:en',
      ]);
      const result = service.resolve(NotificationEventType.ACCESS_GRANTED, 'fr', {});
      expect(result.subject).toBe('notifications.access_granted.subject');
    });
  });

  describe('getSupportedLanguages', () => {
    it('returns en, fr, ar', () => {
      expect(service.getSupportedLanguages()).toEqual(['en', 'fr', 'ar']);
    });
  });

  describe('isSupportedLanguage', () => {
    it('returns true for supported languages', () => {
      expect(service.isSupportedLanguage('en')).toBe(true);
      expect(service.isSupportedLanguage('fr')).toBe(true);
      expect(service.isSupportedLanguage('ar')).toBe(true);
    });

    it('returns false for unsupported languages', () => {
      expect(service.isSupportedLanguage('es')).toBe(false);
      expect(service.isSupportedLanguage('de')).toBe(false);
      expect(service.isSupportedLanguage('')).toBe(false);
    });
  });
});
