import { Injectable, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../auth/entities/user.entity';

/**
 * RBAC guard adapted for GraphQL resolvers.
 * Works with the @Roles() decorator on resolver methods.
 */
@Injectable()
export class GqlRolesGuard {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles?.length) return true;

    const ctx = GqlExecutionContext.create(context);
    const { req } = ctx.getContext<{ req: any }>();
    const user = req?.user;

    if (!user) throw new ForbiddenException('User not found in request');

    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException(`Access denied. Required roles: ${requiredRoles.join(', ')}`);
    }

    return true;
  }
}
