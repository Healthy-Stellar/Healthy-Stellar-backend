import { Injectable, NestMiddleware, PayloadTooLargeException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as bodyParser from 'body-parser';

const MAX_WEBHOOK_BODY_SIZE = '1mb';

/**
 * Captures the raw request buffer before JSON parsing so HMAC can be
 * computed over the original wire bytes.
 */
@Injectable()
export class RawBodyMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    bodyParser.json({
      limit: MAX_WEBHOOK_BODY_SIZE,
      verify: (req: any, _res, buf) => {
        req.rawBody = buf.toString('utf8');
      },
    })(req, res, (err?: any) => {
      if (err) {
        // body-parser emits a 413 error when the limit is exceeded
        if (err.status === 413 || err.type === 'entity.too.large') {
          throw new PayloadTooLargeException('Webhook payload exceeds maximum allowed size');
        }
        throw err;
      }
      next();
    });
  }
}
