import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * HIPAA Security Headers Middleware
 * Implements security headers required for healthcare data protection
 */
@Injectable()
export class HipaaHeadersMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    // Prevent caching of PHI data
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // Content Security Policy - strict for healthcare
    res.setHeader(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self'",
        "img-src 'self' data:",
        "font-src 'self'",
        "connect-src 'self'",
        "frame-ancestors 'none'",
        "form-action 'self'",
        "base-uri 'self'",
        "object-src 'none'",
      ].join('; '),
    );

    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');

    // Enable XSS protection
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // HSTS - enforce HTTPS for 1 year
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

    // Prevent referrer leaking PHI in URLs
    res.setHeader('Referrer-Policy', 'no-referrer');

    // Permissions Policy - restrict browser features
    res.setHeader(
      'Permissions-Policy',
      ['camera=()', 'microphone=()', 'geolocation=()', 'payment=()', 'usb=()', 'bluetooth=()'].join(
        ', ',
      ),
    );

    // Remove server identification headers
    res.removeHeader('X-Powered-By');
    res.removeHeader('Server');

    // HIPAA compliance identifier
    res.setHeader('X-Healthcare-Security', 'HIPAA-Compliant');

    // Correlation ID for audit trails
    const correlationId =
      (req.headers['x-correlation-id'] as string) ||
      `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    res.setHeader('X-Correlation-ID', correlationId);
    (req as Request & { correlationId: string }).correlationId = correlationId;

    next();
  }
}
