import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * Sanitizes incoming requests to prevent injection attacks on healthcare data
 */
@Injectable()
export class RequestSanitizationMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RequestSanitizationMiddleware.name);

  use(req: Request, _res: Response, next: NextFunction): void {
    // Sanitize query parameters
    if (req.query) {
      req.query = this.sanitizeObject(req.query) as typeof req.query;
    }

    // Sanitize body (deep sanitize for nested objects)
    if (req.body && typeof req.body === 'object') {
      req.body = this.sanitizeObject(req.body);
    }

    // Validate content type for POST/PUT/PATCH
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      const contentType = req.headers['content-type'] || '';
      if (
        req.body &&
        !contentType.includes('application/json') &&
        !contentType.includes('multipart/form-data')
      ) {
        this.logger.warn(`Unexpected content-type: ${contentType} for ${req.method} ${req.path}`);
      }
    }

    next();
  }

  private sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        sanitized[key] = this.sanitizeString(value);
      } else if (Array.isArray(value)) {
        sanitized[key] = value.map((item) =>
          typeof item === 'string'
            ? this.sanitizeString(item)
            : typeof item === 'object' && item !== null
              ? this.sanitizeObject(item as Record<string, unknown>)
              : item,
        );
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeObject(value as Record<string, unknown>);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  private sanitizeString(input: string): string {
    return input
      .replace(/[<>]/g, '') // Remove HTML tags
      .replace(/javascript:/gi, '') // Remove JS protocol
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .trim();
  }
}
