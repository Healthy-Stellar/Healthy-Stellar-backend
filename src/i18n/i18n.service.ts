import { Injectable } from '@nestjs/common';
import { I18nService as NestI18nService } from 'nestjs-i18n';
import { I18nContext } from 'nestjs-i18n';

@Injectable()
export class I18nService {
  constructor(private readonly i18n: NestI18nService) {}

  /**
   * Translate a key with optional interpolation variables
   */
  translate(key: string, variables?: Record<string, any>): string {
    try {
      const lang = I18nContext.current()?.lang || 'en';
      return this.i18n.translate(key, {
        lang,
        args: variables,
      });
    } catch {
      // Fallback to key if translation fails
      return key;
    }
  }

  /**
   * Translate multiple keys at once
   */
  translateMultiple(keys: string[], variables?: Record<string, any>): Record<string, string> {
    const result: Record<string, string> = {};
    keys.forEach((key) => {
      result[key] = this.translate(key, variables);
    });
    return result;
  }

  /**
   * Get current language from context
   */
  getCurrentLanguage(): string {
    return I18nContext.current()?.lang || 'en';
  }

  /**
   * Get supported languages
   */
  getSupportedLanguages(): string[] {
    return ['en', 'fr', 'es', 'ar'];
  }

  /**
   * Check if a language is supported
   */
  isLanguageSupported(lang: string): boolean {
    return this.getSupportedLanguages().includes(lang);
  }

  /**
   * Get language from Accept-Language header
   */
  getLanguageFromHeader(acceptLanguage?: string): string {
    if (!acceptLanguage) {
      return 'en';
    }

    // Parse Accept-Language header: en-US,en;q=0.9,fr;q=0.8
    const languages = acceptLanguage
      .split(',')
      .map((lang) => {
        const parts = lang.trim().split(';');
        const langCode = parts[0].split('-')[0].toLowerCase();
        const quality = parts[1] ? parseFloat(parts[1].replace('q=', '')) : 1;
        return { langCode, quality };
      })
      .sort((a, b) => b.quality - a.quality);

    // Find first supported language
    for (const lang of languages) {
      if (this.isLanguageSupported(lang.langCode)) {
        return lang.langCode;
      }
    }

    return 'en';
  }

  /**
   * Translate validation error messages
   */
  translateValidationError(
    field: string,
    constraint: string,
    variables?: Record<string, any>,
  ): string {
    const key = `validation.${constraint}`;
    let message = this.translate(key, variables);

    // If translation key doesn't exist, return constraint as fallback
    if (message === key) {
      message = constraint;
    }

    return `${field}: ${message}`;
  }

  /**
   * Translate error messages for exceptions
   */
  translateError(errorCode: string, variables?: Record<string, any>): string {
    const key = `errors.${errorCode}`;
    const message = this.translate(key, variables);
    return message === key ? errorCode : message;
  }

  /**
   * Translate auth error messages
   */
  translateAuthError(errorCode: string, variables?: Record<string, any>): string {
    const key = `auth.${errorCode}`;
    const message = this.translate(key, variables);
    return message === key ? errorCode : message;
  }

  /**
   * Translate access error messages
   */
  translateAccessError(errorCode: string, variables?: Record<string, any>): string {
    const key = `access.${errorCode}`;
    const message = this.translate(key, variables);
    return message === key ? errorCode : message;
  }

  /**
   * Translate record error messages
   */
  translateRecordError(errorCode: string, variables?: Record<string, any>): string {
    const key = `records.${errorCode}`;
    const message = this.translate(key, variables);
    return message === key ? errorCode : message;
  }

  /**
   * Translate user error messages
   */
  translateUserError(errorCode: string, variables?: Record<string, any>): string {
    const key = `users.${errorCode}`;
    const message = this.translate(key, variables);
    return message === key ? errorCode : message;
  }

  /**
   * Get all translations for a namespace
   */
  getNamespace(namespace: string): Record<string, any> {
    try {
      const lang = I18nContext.current()?.lang || 'en';
      // This is a simplified implementation - in production you'd need to access translations directly
      return {};
    } catch {
      return {};
    }
  }
}
