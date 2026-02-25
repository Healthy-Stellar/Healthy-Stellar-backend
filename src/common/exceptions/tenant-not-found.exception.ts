import { HttpException, HttpStatus } from '@nestjs/common';

export class TenantNotFoundException extends HttpException {
  constructor(tenantId: string) {
    super(
      {
        statusCode: HttpStatus.NOT_FOUND,
        error: 'Not Found',
        message: `Tenant with ID ${tenantId} not found`,
        code: 'TENANT_NOT_FOUND',
      },
      HttpStatus.NOT_FOUND,
    );
  }
}
