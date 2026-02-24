import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuditContext {
  userId: string;
  ipAddress: string;
  userAgent: string;
  requestId: string;
  sessionId?: string;
}

export const AuditCtx = createParamDecorator(
  (data: keyof AuditContext | undefined, ctx: ExecutionContext): AuditContext | any => {
    const request = ctx.switchToHttp().getRequest();
    const auditContext: AuditContext = request.auditContext || {
      userId: request.user?.id || 'anonymous',
      ipAddress: request.ip || request.connection?.remoteAddress,
      userAgent: request.headers['user-agent'] || 'unknown',
      requestId:
        request.headers['x-request-id'] ||
        `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      sessionId: request.session?.id,
    };

    return data ? auditContext[data] : auditContext;
  },
);

export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    return data ? user?.[data] : user;
  },
);

export const IpAddress = createParamDecorator((data: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest();
  return request.ip || request.connection?.remoteAddress || 'unknown';
});

export const UserAgent = createParamDecorator((data: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest();
  return request.headers['user-agent'] || 'unknown';
});
