import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { I18nContext } from 'nestjs-i18n';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    let message =
      exception instanceof HttpException ? exception.getResponse() : 'Internal server error';

    const i18n = I18nContext.current();
    if (i18n) {
      if (typeof message === 'string') {
        message = i18n.translate(message, { lang: i18n.lang }) || message;
      } else if (message && typeof message === 'object' && 'message' in message) {
        let internalMsg = (message as any).message;
        if (typeof internalMsg === 'string') {
          (message as any).message = i18n.translate(internalMsg, { lang: i18n.lang }) || internalMsg;
        } else if (Array.isArray(internalMsg)) {
          (message as any).message = internalMsg.map((msg) =>
            typeof msg === 'string' ? i18n.translate(msg, { lang: i18n.lang }) || msg : msg,
          );
        }
      }
    }

    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message: typeof message === 'string' ? message : (message as any).message || message,
    };

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : JSON.stringify(exception),
      );
    } else {
      this.logger.warn(`${request.method} ${request.url} - ${JSON.stringify(errorResponse)}`);
    }

    response.status(status).json(errorResponse);
  }
}
