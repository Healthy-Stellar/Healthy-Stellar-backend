import { HttpException, HttpStatus } from '@nestjs/common';

export class StellarTransactionException extends HttpException {
  constructor(message: string, txHash?: string, stellarErrorCode?: string) {
    super(
      {
        statusCode: HttpStatus.BAD_GATEWAY,
        error: 'Bad Gateway',
        message,
        code: 'STELLAR_TRANSACTION_ERROR',
        details: {
          txHash,
          stellarErrorCode,
        },
      },
      HttpStatus.BAD_GATEWAY,
    );
  }
}
