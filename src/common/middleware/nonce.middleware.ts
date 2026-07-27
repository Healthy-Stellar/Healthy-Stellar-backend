import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';

/**
 * Middleware to generate a unique nonce for Content-Security-Policy (CSP).
 * The nonce is stored in res.locals.nonce and req['nonce'].
 */
export function nonceMiddleware(req: Request, res: Response, next: NextFunction) {
  const nonce = crypto.randomBytes(16).toString('base64');
  res.locals.nonce = nonce;
  // Also attach to request for easier access in NestJS guards/interceptors
  (req as any).nonce = nonce;
  next();
}
