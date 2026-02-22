import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as bodyParser from 'body-parser';

@Injectable()
export class RawBodyMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    bodyParser.json({
      verify: (req: any, res, buf) => {
        req.rawBody = buf.toString('utf8');
      },
    })(req, res, next);
  }
}
