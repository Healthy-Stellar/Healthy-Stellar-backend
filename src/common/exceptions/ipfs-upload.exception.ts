import { HttpException, HttpStatus } from '@nestjs/common';

export class IpfsUploadException extends HttpException {
  constructor(message: string, details?: any) {
    super(
      {
        statusCode: HttpStatus.BAD_GATEWAY,
        error: 'Bad Gateway',
        message,
        code: 'IPFS_UPLOAD_ERROR',
        details,
      },
      HttpStatus.BAD_GATEWAY,
    );
  }
}
