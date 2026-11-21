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
    return ['en', 'fr', 'es', 'ar', 'he'];
  }

  /**
   * RTL locale codes
   */
  private readonly rtlLocales = new Set(['ar', 'he']);

  /**
   * Returns true if the given (or current) locale is a right-to-left language.
   */
  isRtlLocale(lang?: string): boolean {
    const locale = (lang || this.getCurrentLanguage()).toLowerCase();
    return this.rtlLocales.has(locale);
  }

  /**
   * Returns the HTML `dir` attribute value for the given (or current) locale.
   */
  getTextDirection(lang?: string): 'rtl' | 'ltr' {
    return this.isRtlLocale(lang) ? 'rtl' : 'ltr';
  }

  /**
   * Format a date according to the current locale.
   * Falls back to en-US if the Intl formatter is unavailable.
   */
  formatDate(date: Date | string | number, options?: Intl.DateTimeFormatOptions): string {
    try {
      const lang = this.getCurrentLanguage();
      const locale = this.rtlLocales.has(lang) ? `${lang}-${lang.toUpperCase()}` : lang;
      return new Intl.DateTimeFormat(locale, options).format(new Date(date));
    } catch {
      return new Date(date).toLocaleDateString('en-US', options);
    }
  }

  /**
   * Format a number according to the current locale.
   */
  formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
    try {
      const lang = this.getCurrentLanguage();
      return new Intl.NumberFormat(lang, options).format(value);
    } catch {
      return value.toLocaleString('en-US', options);
    }
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
