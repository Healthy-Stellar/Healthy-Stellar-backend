import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DlqController } from './dlq.controller';
import { DlqJobsController } from './dlq-jobs.controller';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../auth/entities/user.entity';

describe('DLQ controller authorization', () => {
  const guard = new RolesGuard(new Reflector());
  const controllers = [DlqController, DlqJobsController];

  function contextFor(controller: Function, role: UserRole): ExecutionContext {
    return {
      getClass: () => controller,
      getHandler: () => () => undefined,
      switchToHttp: () => ({
        getRequest: () => ({ user: { role } }),
      }),
    } as ExecutionContext;
  }

  it.each(controllers)('%p denies tenant admins', (controller) => {
    expect(() => guard.canActivate(contextFor(controller, UserRole.ADMIN))).toThrow(
      ForbiddenException,
    );
  });

  it.each(controllers)('%p allows platform super admins', (controller) => {
    expect(guard.canActivate(contextFor(controller, UserRole.SUPER_ADMIN))).toBe(true);
  });
});
