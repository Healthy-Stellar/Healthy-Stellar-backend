import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

interface ErrorResponse {
  statusCode: number;
  error: string;
  message: string;
  code: string;
  traceId: string;
  timestamp: string;
  path: string;
  details?: any;
}
import { I18nContext } from 'nestjs-i18n';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const traceId = uuidv4();

    // Check if FHIR endpoint
    if (request.path.startsWith('/fhir')) {
      return this.handleFhirException(exception, response, request);
    }

    let statusCode: number;
    let error: string;
    let message: string;
    let code: string;
    let details: any;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object') {
        const resp = exceptionResponse as any;
        error = resp.error || this.getHttpErrorName(statusCode);
        message = resp.message || exception.message;
        code = resp.code || this.getDefaultErrorCode(statusCode);
        details = resp.details;

        // Handle ValidationPipe errors
        if (exception instanceof BadRequestException && Array.isArray(resp.message)) {
          details = resp.message.map((msg: any) => ({
            field: typeof msg === 'string' ? undefined : msg.property,
            message: typeof msg === 'string' ? msg : Object.values(msg.constraints || {}).join(', '),
          }));
          message = 'Validation failed';
        }
      } else {
        error = this.getHttpErrorName(statusCode);
        message = exceptionResponse as string;
        code = this.getDefaultErrorCode(statusCode);
      }
    } else {
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      error = 'Internal Server Error';
      message = 'An unexpected error occurred';
      code = 'INTERNAL_ERROR';
    }

    const errorResponse: ErrorResponse = {
      statusCode,
      error,
      message,
      code,
      traceId,
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
    };

    if (details) {
      errorResponse.details = details;
    }

    // Logging
    if (statusCode >= 500) {
      this.logger.error(
        `[${traceId}] ${request.method} ${request.url} - ${message}`,
        exception instanceof Error ? exception.stack : JSON.stringify(exception),
      );
    } else {
      this.logger.warn(`[${traceId}] ${request.method} ${request.url} - ${message}`);
    }

    response.status(statusCode).json(errorResponse);
  }

  private handleFhirException(exception: unknown, response: Response, request: Request) {
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const message = exception instanceof HttpException ? exception.message : 'Internal server error';

    const outcome = {
      resourceType: 'OperationOutcome',
      issue: [
        {
          severity: status >= 500 ? 'error' : 'warning',
          code: status === 404 ? 'not-found' : status === 400 ? 'invalid' : 'exception',
          diagnostics: message,
        },
      ],
    };

    response.status(status).contentType('application/fhir+json').json(outcome);
  }

  private getHttpErrorName(statusCode: number): string {
    const errorNames: Record<number, string> = {
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      409: 'Conflict',
      422: 'Unprocessable Entity',
      500: 'Internal Server Error',
      502: 'Bad Gateway',
      503: 'Service Unavailable',
    };
    return errorNames[statusCode] || 'Error';
  }

  private getDefaultErrorCode(statusCode: number): string {
    const errorCodes: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'VALIDATION_ERROR',
      500: 'INTERNAL_ERROR',
      502: 'BAD_GATEWAY',
      503: 'SERVICE_UNAVAILABLE',
    };
    return errorCodes[statusCode] || 'UNKNOWN_ERROR';
  }
}

// Legacy export for backward compatibility
export const HttpExceptionFilter = GlobalExceptionFilter;
