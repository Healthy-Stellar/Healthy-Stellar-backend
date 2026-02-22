import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { FhirOperationOutcome } from '../dto/fhir-resources.dto';

@Catch()
export class FhirExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const message = exception instanceof HttpException ? exception.message : 'Internal server error';

    const outcome: FhirOperationOutcome = {
      resourceType: 'OperationOutcome',
      issue: [{
        severity: status >= 500 ? 'error' : 'warning',
        code: status === 404 ? 'not-found' : status === 400 ? 'invalid' : 'exception',
        diagnostics: message
      }]
    };

    response.status(status).contentType('application/fhir+json').json(outcome);
  }
}
