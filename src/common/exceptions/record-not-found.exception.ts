import { HttpException, HttpStatus } from '@nestjs/common';

export class RecordNotFoundException extends HttpException {
  constructor(recordType: string, id: string) {
    super(
      {
        statusCode: HttpStatus.NOT_FOUND,
        error: 'Not Found',
        message: `${recordType} with ID ${id} not found`,
        code: 'RECORD_NOT_FOUND',
      },
      HttpStatus.NOT_FOUND,
    );
  }
}
