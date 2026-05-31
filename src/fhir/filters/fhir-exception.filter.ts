import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, ConflictException } from '@nestjs/common';
import { Response } from 'express';
import { FhirOperationOutcome } from '../dto/fhir-resources.dto';

@Catch()
export class FhirExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let outcome: FhirOperationOutcome;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const resp = exceptionResponse as any;
        message = resp.message || exception.message;

        // If there's already an OperationOutcome in the response, use it
        if (resp.operationOutcome) {
          outcome = resp.operationOutcome;
        } else {
          // Generate OperationOutcome from exception details
          outcome = this.createOperationOutcome(status, message, resp.code, resp.details);
        }
      } else {
        message = exceptionResponse as string;
        outcome = this.createOperationOutcome(status, message);
      }
    } else {
      outcome = this.createOperationOutcome(HttpStatus.INTERNAL_SERVER_ERROR, 'Internal server error');
    }

    response.status(status).contentType('application/fhir+json').json(outcome);
  }

  private createOperationOutcome(
    status: number,
    message: string,
    code?: string,
    details?: any,
  ): FhirOperationOutcome {
    const severity = status >= 500 ? 'error' : status >= 400 ? 'warning' : 'information';
    let fhirCode = 'exception';

    if (status === 404) {
      fhirCode = 'not-found';
    } else if (status === 400) {
      fhirCode = 'invalid';
    } else if (status === 409) {
      fhirCode = 'conflict';
    } else if (status === 401 || status === 403) {
      fhirCode = 'security';
    }

    const outcome: FhirOperationOutcome = {
      resourceType: 'OperationOutcome',
      issue: [
        {
          severity,
          code: fhirCode,
          diagnostics: message,
          ...(code && { expression: [code] }),
          ...(details && { details: { text: JSON.stringify(details) } }),
        },
      ],
    };

    return outcome;
  }
}
