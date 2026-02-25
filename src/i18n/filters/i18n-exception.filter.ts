import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { Response, Request } from 'express';
import { I18nService } from '../i18n.service';
import { I18nContext } from 'nestjs-i18n';

@Catch(HttpException)
export class I18nExceptionFilter implements ExceptionFilter {
  constructor(
    @Inject(I18nService) private readonly i18nService: I18nService,
  ) {}

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();

    // Ensure I18n context is available
    const lang = this.extractLanguage(request);
    I18nContext.current().setLanguage(lang);

    const exceptionResponse = exception.getResponse() as any;
    let message = exception.message;
    let translatedMessage = message;

    // Translate common HTTP exceptions
    if (status === HttpStatus.NOT_FOUND) {
      translatedMessage = this.i18nService.translate('errors.notFound');
    } else if (status === HttpStatus.UNAUTHORIZED) {
      translatedMessage = this.i18nService.translate('errors.unauthorized');
    } else if (status === HttpStatus.FORBIDDEN) {
      translatedMessage = this.i18nService.translate('errors.forbidden');
    } else if (status === HttpStatus.BAD_REQUEST) {
      translatedMessage = this.i18nService.translate('errors.badRequest');
    } else if (status === HttpStatus.CONFLICT) {
      translatedMessage = this.i18nService.translate('errors.conflict');
    } else if (status === HttpStatus.UNPROCESSABLE_ENTITY) {
      translatedMessage = this.i18nService.translate('errors.unprocessableEntity');
    } else if (status === HttpStatus.TOO_MANY_REQUESTS) {
      translatedMessage = this.i18nService.translate('errors.tooManyRequests');
    } else if (status === HttpStatus.SERVICE_UNAVAILABLE) {
      translatedMessage = this.i18nService.translate('errors.serviceUnavailable');
    } else if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      translatedMessage = this.i18nService.translate('errors.internalServerError');
    } else if (typeof exceptionResponse.message === 'string') {
      // If it's a custom error message, try to translate it
      const key = this.messageToTranslationKey(exceptionResponse.message);
      if (key) {
        translatedMessage = this.i18nService.translate(key);
      }
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: translatedMessage,
      error: exceptionResponse.error || this.getStatusText(status),
      // Include original errors if validation errors
      ...(exceptionResponse.errors && { errors: exceptionResponse.errors }),
    });
  }

  /**
   * Extract language from request
   */
  private extractLanguage(request: Request): string {
    const acceptLanguage = request.headers['accept-language'] as string | undefined;
    return this.i18nService.getLanguageFromHeader(acceptLanguage);
  }

  /**
   * Convert error message to translation key
   * Examples: "emailAlreadyExists" -> "auth.emailAlreadyExists"
   */
  private messageToTranslationKey(message: string): string | null {
    // Map common error patterns
    const patterns: Record<string, string> = {
      emailAlreadyExists: 'auth.emailAlreadyExists',
      usernameAlreadyExists: 'auth.usernameAlreadyExists',
      invalidCredentials: 'auth.invalidCredentials',
      emailNotVerified: 'auth.emailNotVerified',
      accountLocked: 'auth.accountLocked',
      invalidEmail: 'auth.invalidEmail',
      passwordTooWeak: 'auth.passwordTooWeak',
      passwordsDoNotMatch: 'auth.passwordsDoNotMatch',
      recordNotFound: 'records.recordNotFound',
      recordAccessDenied: 'records.recordAccessDenied',
      accessGranted: 'access.accessGranted',
      accessDenied: 'access.accessDenied',
      insufficientPermissions: 'access.insufficientPermissions',
      userNotFound: 'users.userNotFound',
      invalidRole: 'users.invalidRole',
    };

    return patterns[message] || null;
  }

  /**
   * Get HTTP status text
   */
  private getStatusText(status: number): string {
    const statusTexts: Record<number, string> = {
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      409: 'Conflict',
      422: 'Unprocessable Entity',
      429: 'Too Many Requests',
      500: 'Internal Server Error',
      503: 'Service Unavailable',
    };

    return statusTexts[status] || 'Unknown Error';
  }
}
