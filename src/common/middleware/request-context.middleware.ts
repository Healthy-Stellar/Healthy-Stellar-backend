import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';
import { trace, context } from '@opentelemetry/api';

export interface RequestContext {
  requestId: string;
  traceId: string;
  spanId?: string;
  tenantId?: string;
  userId?: string;
  role?: string;
  timestamp: string;
}

export const asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Get trace context from OpenTelemetry if available
    const span = trace.getSpan(context.active());
    const spanContext = span?.spanContext();

    const requestId = (req.headers['x-request-id'] as string) || randomUUID();
    const traceId = spanContext?.traceId || (req.headers['x-trace-id'] as string) || randomUUID();
    const spanId = spanContext?.spanId;

    const tenantId = req.headers['x-tenant-id'] as string;

    // Identity (userId / role) is intentionally NOT read here. Middleware runs
    // before guards, so req.user is never set yet, and client-supplied headers
    // such as x-user-id must never be trusted as identity. JwtAuthGuard
    // populates these fields via setRequestContextUser() after verifying the
    // token.
    const userId: string | undefined = undefined;
    const role: string | undefined = undefined;

    const context_obj: RequestContext = {
      requestId,
      traceId,
      spanId,
      tenantId,
      userId,
      role,
      timestamp: new Date().toISOString(),
    };

    // Set request ID in response header
    res.setHeader('X-Request-ID', requestId);
    res.setHeader('X-Trace-ID', traceId);
    if (spanId) {
      res.setHeader('X-Span-ID', spanId);
    }

    // Store context in AsyncLocalStorage
    asyncLocalStorage.run(context_obj, () => {
      next();
    });
  }
}

// Helper function to get current context
export function getRequestContext(): RequestContext | undefined {
  return asyncLocalStorage.getStore();
}

/**
 * Records the authenticated caller on the current request context.
 * Must only be called after the caller's credentials have been verified
 * (e.g. from JwtAuthGuard). No-op outside a request scope.
 */
export function setRequestContextUser(user: { userId?: string; role?: string } | undefined): void {
  const store = asyncLocalStorage.getStore();
  if (!store) return;
  store.userId = user?.userId;
  store.role = user?.role;
}
