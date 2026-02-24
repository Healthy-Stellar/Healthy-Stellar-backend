import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { AuditLogService } from '../audit/audit-log.service';

export interface SafeErrorResponse {
  statusCode: number;
  message: string;
  timestamp: string;
  requestId?: string;
}

@Injectable()
export class HIPAACCompliantErrorHandler {
  constructor(private auditService: AuditLogService) {}

  handleValidationError(error: any, context: string): SafeErrorResponse {
    this.auditService.logValidationFailure({
      context,
      timestamp: new Date(),
      errorType: 'VALIDATION_ERROR',
      severity: 'MEDIUM',
    });

    return {
      statusCode: 400,
      message: 'Medical data validation failed. Please check your input.',
      timestamp: new Date().toISOString(),
    };
  }

  handleUnauthorizedAccess(context: string, requestId?: string): UnauthorizedException {
    this.auditService.logUnauthorizedAccess({
      context,
      timestamp: new Date(),
      requestId,
    });

    return new UnauthorizedException('Access denied');
  }

  handleForbiddenAccess(context: string, requestId?: string): ForbiddenException {
    this.auditService.logForbiddenAccess({
      context,
      timestamp: new Date(),
      requestId,
    });

    return new ForbiddenException('You do not have permission to access this resource');
  }

  handleMedicalRecordError(error: any, context: string): SafeErrorResponse {
    this.auditService.logMedicalRecordError({
      context,
      timestamp: new Date(),
      errorType: error.name,
      severity: 'HIGH',
    });

    return {
      statusCode: 400,
      message: 'An error occurred while processing medical records',
      timestamp: new Date().toISOString(),
    };
  }

  handleDatabaseError(error: any, context: string): SafeErrorResponse {
    this.auditService.logDatabaseError({
      context,
      timestamp: new Date(),
      errorType: error.name,
      severity: 'CRITICAL',
    });

    return {
      statusCode: 500,
      message: 'An internal server error occurred',
      timestamp: new Date().toISOString(),
    };
  }

  handleEmergencyAlert(alertData: any, context: string): SafeErrorResponse {
    this.auditService.logEmergencyAlert({
      context,
      timestamp: new Date(),
      alertData,
      severity: 'CRITICAL',
    });

    return {
      statusCode: 200,
      message: 'Emergency alert processed',
      timestamp: new Date().toISOString(),
    };
  }
}
