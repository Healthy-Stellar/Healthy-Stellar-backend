import { HttpException, HttpStatus } from '@nestjs/common';

export class AccessDeniedException extends HttpException {
  constructor(resource: string, reason?: string) {
    super(
      {
        statusCode: HttpStatus.FORBIDDEN,
        error: 'Forbidden',
        message: reason || `Access denied to ${resource}`,
        code: 'ACCESS_DENIED',
      },
      HttpStatus.FORBIDDEN,
    );
  }
}
