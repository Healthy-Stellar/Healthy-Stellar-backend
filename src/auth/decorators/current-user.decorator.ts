import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { JwtPayload } from '../services/auth-token.service';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): JwtPayload => {
    const request = context.switchToHttp().getRequest<{ user?: JwtPayload }>();
    if (!request.user) {
      throw new UnauthorizedException('No authenticated user found');
    }

    return request.user;
  },
);
