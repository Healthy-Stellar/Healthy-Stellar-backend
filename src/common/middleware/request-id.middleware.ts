import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { asyncLocalStorage } from './request-context.middleware';

export const REQUEST_ID_HEADER = 'x-request-id';

/**
 * RequestIdMiddleware
 *
 * Generates or forwards the X-Request-Id header on every HTTP request:
 *  - Forwards the existing value if the header is already present (from a gateway/proxy)
 *  - Generates a UUID v4 if the header is absent
 *
 * The resolved requestId is:
 *  1. Written back to the response as X-Request-Id
 *  2. Stored in the AsyncLocalStorage context (shared with RequestContextMiddleware)
 *     so it is available in all log lines and error responses without prop-drilling
 *
 * Registration order matters — this middleware should run BEFORE any logging
 * interceptors so the requestId is available when they execute.
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    // Forward existing header (from gateway/load balancer) or generate a new UUID v4
    const requestId =
      (req.headers[REQUEST_ID_HEADER] as string | undefined)?.trim() || randomUUID();

    // Normalise the incoming header so downstream code always sees it
    req.headers[REQUEST_ID_HEADER] = requestId;

    // Return it in the response so clients can correlate logs
    res.setHeader('X-Request-Id', requestId);

    // Patch the AsyncLocalStorage store if it already exists (set by RequestContextMiddleware)
    // so both middlewares share the same requestId value
    const store = asyncLocalStorage.getStore();
    if (store) {
      store.requestId = requestId;
    }

    next();
  }
}
