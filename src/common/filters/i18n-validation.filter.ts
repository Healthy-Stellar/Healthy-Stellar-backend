import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { I18nService, I18nValidationException } from 'nestjs-i18n';
import { Response } from 'express';

@Catch(I18nValidationException)
export class CustomI18nValidationFilter implements ExceptionFilter {
  constructor(private readonly i18n: I18nService) {}

  catch(exception: I18nValidationException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const statusCode = HttpStatus.BAD_REQUEST;

    // The current locale is automatically parsed from the Accept-Language header
    const lang = ctx.getRequest().i18nLang; 

    // Translate the raw validation errors
    const errors = this.formatErrors(exception.errors, lang);

    response.status(statusCode).json({
      statusCode,
      message: 'Validation failed',
      errors,
    });
  }

  private formatErrors(errors: any[], lang: string): any {
    return errors.map((error) => {
      const constraints = {};
      
      if (error.constraints) {
        for (const [key, value] of Object.entries(error.constraints)) {
          // Translate the message using nestjs-i18n
          constraints[key] = this.i18n.translate(`validation.${key.toUpperCase()}`, {
            lang,
            args: { property: error.property },
          });
        }
      }

      return {
        property: error.property,
        constraints,
        ...(error.children && error.children.length > 0 
            ? { children: this.formatErrors(error.children, lang) } 
            : {}),
      };
    });
  }
}