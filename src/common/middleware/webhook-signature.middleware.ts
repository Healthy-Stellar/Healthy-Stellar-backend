import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';

@Injectable()
export class WebhookSignatureMiddleware implements NestMiddleware {
  private readonly secret: string;
  private readonly maxAge = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.secret = process.env.WEBHOOK_SECRET;
    if (!this.secret) {
      throw new Error('WEBHOOK_SECRET environment variable is required');
    }
  }

  use(req: Request, res: Response, next: NextFunction) {
    const signature = req.headers['x-webhook-signature'] as string;

    if (!signature) {
      throw new UnauthorizedException();
    }

    const [timestamp, receivedSignature] = signature.split('.');
    
    if (!timestamp || !receivedSignature) {
      throw new UnauthorizedException();
    }

    // Replay attack prevention
    const requestTime = parseInt(timestamp, 10);
    if (isNaN(requestTime) || Date.now() - requestTime > this.maxAge) {
      throw new UnauthorizedException();
    }

    // Compute expected signature
    const rawBody = (req as any).rawBody || '';
    const payload = `${timestamp}.${rawBody}`;
    const expectedSignature = crypto
      .createHmac('sha256', this.secret)
      .update(payload)
      .digest('hex');

    // Constant-time comparison
    if (!crypto.timingSafeEqual(Buffer.from(receivedSignature), Buffer.from(expectedSignature))) {
      throw new UnauthorizedException();
    }

    next();
  }
}
