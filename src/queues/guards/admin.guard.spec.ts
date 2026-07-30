import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AdminGuard } from './admin.guard';

describe('AdminGuard', () => {
  let guard: AdminGuard;
  let mockExecutionContext: ExecutionContext;

  beforeEach(() => {
    guard = new AdminGuard();
  });

  it('should allow authenticated admin users', () => {
    const mockRequest = {
      user: { id: 'user-1', role: 'admin' },
    };
    mockExecutionContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    } as ExecutionContext;

    const result = guard.canActivate(mockExecutionContext);
    expect(result).toBe(true);
  });

  it('should throw UnauthorizedException for unauthenticated requests', () => {
    const mockRequest = {
      user: undefined,
    };
    mockExecutionContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    } as ExecutionContext;

    expect(() => guard.canActivate(mockExecutionContext)).toThrow(UnauthorizedException);
  });

  it('should throw ForbiddenException for non-admin authenticated users', () => {
    const mockRequest = {
      user: { id: 'user-2', role: 'user' },
    };
    mockExecutionContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    } as ExecutionContext;

    expect(() => guard.canActivate(mockExecutionContext)).toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException for authenticated users with other roles', () => {
    const mockRequest = {
      user: { id: 'user-3', role: 'provider' },
    };
    mockExecutionContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    } as ExecutionContext;

    expect(() => guard.canActivate(mockExecutionContext)).toThrow(ForbiddenException);
  });
});
