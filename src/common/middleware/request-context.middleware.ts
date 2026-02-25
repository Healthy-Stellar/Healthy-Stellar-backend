import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';

export interface RequestContext {
  requestId: string;
  traceId: string;
  tenantId?: string;
  userId?: string;
  timestamp: string;
}

export const asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const requestId = (req.headers['x-request-id'] as string) || randomUUID();
    const traceId = (req.headers['x-trace-id'] as string) || randomUUID();
    
    // Extract from JWT or headers if available
    const tenantId = req.headers['x-tenant-id'] as string;
    const userId = (req as any).user?.id || (req.headers['x-user-id'] as string);

    const context: RequestContext = {
      requestId,
      traceId,
      tenantId,
      userId,
      timestamp: new Date().toISOString(),
    };

    // Set request ID in response header
    res.setHeader('X-Request-ID', requestId);
    res.setHeader('X-Trace-ID', traceId);

    // Store context in AsyncLocalStorage
    asyncLocalStorage.run(context, () => {
      next();
    });
  }
}

// Helper function to get current context
export function getRequestContext(): RequestContext | undefined {
  return asyncLocalStorage.getStore();
}
