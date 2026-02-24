import { ExceptionFilter, Catch, ArgumentsHost, HttpStatus, Inject } from '@nestjs/common';
import { Request, Response } from 'express';
import { HIPAACCompliantErrorHandler } from './hipaa-compliant-error-handler';

@Catch()
export class MedicalEmergencyErrorFilter implements ExceptionFilter {
  constructor(
    @Inject(HIPAACCompliantErrorHandler)
    private errorHandler: HIPAACCompliantErrorHandler,
  ) {}

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId = (request as any).id || 'unknown';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let safeResponse: any;

    if (exception.name === 'EmergencyAlertError') {
      status = HttpStatus.OK;
      safeResponse = this.errorHandler.handleEmergencyAlert(exception.data, 'EMERGENCY_ALERT');
    } else if (exception.status === 400) {
      status = HttpStatus.BAD_REQUEST;
      safeResponse = this.errorHandler.handleValidationError(exception, 'VALIDATION_ERROR');
    } else if (exception.status === 401) {
      status = HttpStatus.UNAUTHORIZED;
      return response.status(status).json({
        statusCode: status,
        message: 'Unauthorized access',
        timestamp: new Date().toISOString(),
      });
    } else if (exception.status === 403) {
      status = HttpStatus.FORBIDDEN;
      return response.status(status).json({
        statusCode: status,
        message: 'Forbidden',
        timestamp: new Date().toISOString(),
      });
    } else {
      safeResponse = this.errorHandler.handleMedicalRecordError(exception, 'GENERAL_ERROR');
    }

    safeResponse.requestId = requestId;
    response.status(status).json(safeResponse);
  }
}
