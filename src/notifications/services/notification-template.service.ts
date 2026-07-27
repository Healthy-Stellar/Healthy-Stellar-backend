import { Injectable, Logger } from '@nestjs/common';
import { I18nService as NestI18nService } from 'nestjs-i18n';
import { NotificationEventType, LocalizedNotification } from '../interfaces/notification-event.interface';

const EVENT_TYPE_TO_KEY: Record<string, string> = {
  [NotificationEventType.RECORD_ACCESSED]: 'record_accessed',
  [NotificationEventType.ACCESS_GRANTED]: 'access_granted',
  [NotificationEventType.ACCESS_REVOKED]: 'access_revoked',
  [NotificationEventType.RECORD_UPLOADED]: 'record_uploaded',
  [NotificationEventType.EMERGENCY_ACCESS]: 'emergency_access',
};

const SUPPORTED_LANGUAGES = ['en', 'fr', 'ar'];
const FALLBACK_LANGUAGE = 'en';

@Injectable()
export class NotificationTemplateService {
  private readonly logger = new Logger(NotificationTemplateService.name);

  constructor(private readonly i18n: NestI18nService) {}

  /**
   * Resolve a localized notification template for the given event type and language.
   * Falls back to English if the requested language is unsupported or the key is missing.
   */
  resolve(
    eventType: NotificationEventType,
    preferredLanguage: string,
    args: Record<string, any> = {},
  ): LocalizedNotification {
    const templateKey = EVENT_TYPE_TO_KEY[eventType];
    if (!templateKey) {
      this.logger.warn(`No template key mapped for event type: ${eventType}`);
      return { subject: eventType, body: eventType, lang: FALLBACK_LANGUAGE };
    }

    const lang = SUPPORTED_LANGUAGES.includes(preferredLanguage)
      ? preferredLanguage
      : FALLBACK_LANGUAGE;

    const subject = this.translateWithFallback(`notifications.${templateKey}.subject`, lang, args);
    const body = this.translateWithFallback(`notifications.${templateKey}.body`, lang, args);

    return { subject, body, lang };
  }

  private translateWithFallback(key: string, lang: string, args: Record<string, any>): string {
    try {
      const result = this.i18n.translate(key, { lang, args }) as string;
      // nestjs-i18n returns the key itself when not found
      if (result && result !== key) {
        return result;
      }
    } catch {
      this.logger.debug(`Translation missing for key "${key}" in lang "${lang}", falling back to en`);
    }

    if (lang !== FALLBACK_LANGUAGE) {
      try {
        const fallback = this.i18n.translate(key, { lang: FALLBACK_LANGUAGE, args }) as string;
        if (fallback && fallback !== key) {
          return fallback;
        }
      } catch {
        this.logger.debug(`Fallback translation also missing for key "${key}"`);
      }
    }

    return key;
  }

  getSupportedLanguages(): string[] {
    return [...SUPPORTED_LANGUAGES];
  }

  isSupportedLanguage(lang: string): boolean {
    return SUPPORTED_LANGUAGES.includes(lang);
  }
}
