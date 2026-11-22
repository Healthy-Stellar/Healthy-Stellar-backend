import { UnauthorizedException } from '@nestjs/common';

/**
 * Returns the authenticated actor's id from `req.user`, as set by
 * JwtAuthGuard (`userId`) or the passport JwtStrategy (`id`). Never fall back
 * to a body field or a placeholder id: a missing user means the route was
 * reached without authentication.
 */
export function authenticatedUserId(req: { user?: { userId?: string; id?: string } }): string {
  const userId = req?.user?.userId ?? req?.user?.id;
  if (!userId) {
    throw new UnauthorizedException('Authentication required');
  }
  return userId;
}
