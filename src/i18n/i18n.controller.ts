import { Controller, Get, Query, Res, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { I18nService } from '../i18n.service';
import { ApiOperation, ApiResponse, ApiTags, ApiQuery } from '@nestjs/swagger';

@ApiTags('i18n')
@Controller('i18n')
export class I18nController {
  constructor(private readonly i18nService: I18nService) {}

  @Get('supported-languages')
  @ApiOperation({ summary: 'Get list of supported languages' })
  @ApiResponse({
    status: 200,
    description: 'List of supported language codes',
    schema: {
      example: {
        languages: ['en', 'fr', 'es', 'ar'],
        default: 'en',
      },
    },
  })
  getSupportedLanguages() {
    return {
      languages: this.i18nService.getSupportedLanguages(),
      default: 'en',
    };
  }

  @Get('translations')
  @ApiOperation({ summary: 'Get all translations for a specific language' })
  @ApiQuery({
    name: 'lang',
    required: false,
    description: 'Language code (en, fr, es, ar). Defaults to Accept-Language header or en',
  })
  @ApiResponse({
    status: 200,
    description: 'Translations object for the requested language',
  })
  async getTranslations(
    @Query('lang') lang?: string,
    @Res() res?: Response,
  ) {
    const requestedLang = lang && this.i18nService.isLanguageSupported(lang) 
      ? lang 
      : this.i18nService.getCurrentLanguage();

    // In production, you would load the actual translation file here
    // For now, we return a success response indicating the language
    return res.status(HttpStatus.OK).json({
      language: requestedLang,
      message: `Translations for ${requestedLang} requested`,
    });
  }

  @Get('current-language')
  @ApiOperation({ summary: 'Get the current language from request context' })
  @ApiResponse({
    status: 200,
    description: 'Current language code',
    schema: {
      example: {
        language: 'en',
      },
    },
  })
  getCurrentLanguage() {
    return {
      language: this.i18nService.getCurrentLanguage(),
    };
  }

  @Get('test-translation')
  @ApiOperation({ summary: 'Test translation of a specific key' })
  @ApiQuery({
    name: 'key',
    required: true,
    description: 'Translation key to test (e.g., "common.error", "auth.loginSuccess")',
  })
  @ApiQuery({
    name: 'lang',
    required: false,
    description: 'Language code (en, fr, es, ar). Defaults to Accept-Language header or en',
  })
  @ApiResponse({
    status: 200,
    description: 'Translated text for the requested key',
  })
  testTranslation(
    @Query('key') key: string,
  ) {
    return {
      key,
      translation: this.i18nService.translate(key),
      language: this.i18nService.getCurrentLanguage(),
    };
  }

  @Get('language-info')
  @ApiOperation({ summary: 'Get language information' })
  @ApiResponse({
    status: 200,
    description: 'Language information',
    schema: {
      example: {
        currentLanguage: 'en',
        supportedLanguages: ['en', 'fr', 'es', 'ar'],
        isSupported: true,
      },
    },
  })
  getLanguageInfo() {
    const currentLang = this.i18nService.getCurrentLanguage();
    return {
      currentLanguage: currentLang,
      supportedLanguages: this.i18nService.getSupportedLanguages(),
      isSupported: this.i18nService.isLanguageSupported(currentLang),
    };
  }

  @Get('health')
  @ApiOperation({ summary: 'Check i18n service health' })
  @ApiResponse({
    status: 200,
    description: 'i18n service is healthy',
  })
  healthCheck() {
    return {
      status: 'healthy',
      service: 'i18n',
      supportedLanguages: this.i18nService.getSupportedLanguages().length,
      timestamp: new Date().toISOString(),
    };
  }
}
