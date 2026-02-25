import { HttpException, HttpStatus } from '@nestjs/common';

export class KeyManagementException extends HttpException {
  constructor(message: string, status: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR) {
    super(message, status);
  }
}

export class KeyNotFoundException extends KeyManagementException {
  constructor(patientId: string) {
    super(`Key not found for patient: ${patientId}`, HttpStatus.NOT_FOUND);
  }
}

export class KeyRotationException extends KeyManagementException {
  constructor(patientId: string, reason: string) {
    super(`Key rotation failed for patient ${patientId}: ${reason}`, HttpStatus.INTERNAL_SERVER_ERROR);
  }
}