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

    // Extract from JWT or headers if available
    const tenantId = req.headers['x-tenant-id'] as string;
    const user = (req as any).user;
    const userId = user?.userId || (req.headers['x-user-id'] as string);
    const role = user?.role;

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
