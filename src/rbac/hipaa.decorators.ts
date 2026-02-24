import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { HIPAA_ROLES_KEY, MINIMUM_NECESSARY_KEY } from '../guards/hipaa-access.guard';

/**
 * Decorator to specify required HIPAA roles for endpoint access
 * @example @HipaaRoles('physician', 'nurse', 'admin')
 */
export const HipaaRoles = (...roles: string[]) => SetMetadata(HIPAA_ROLES_KEY, roles);

/**
 * Marks an endpoint as requiring minimum necessary access review
 * Use this to flag that the response should be filtered to minimum PHI needed
 */
export const MinimumNecessary = (dataTypes: string[]) =>
  SetMetadata(MINIMUM_NECESSARY_KEY, dataTypes);

/**
 * Extracts the correlation ID from the request headers
 */
export const CorrelationId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest<Request & { correlationId?: string }>();
    return request.correlationId;
  },
);

/**
 * Extracts the current authenticated user from the request
 */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<Request & { user?: unknown }>();
  return request.user;
});

/**
 * Marks an endpoint as a PHI access point (adds enhanced audit logging)
 */
export const PhiAccess = (resourceType: string) => SetMetadata('phi_resource_type', resourceType);

/**
 * Emergency override decorator (break-glass access)
 * All break-glass uses are heavily audited
 */
export const BreakGlass = (reason?: string) =>
  SetMetadata('break_glass', { allowed: true, reason });
