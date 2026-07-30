import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard that runs the 'oidc' Passport strategy.
 * Attach to the callback route: @UseGuards(OidcAuthGuard)
 */
@Injectable()
export class OidcAuthGuard extends AuthGuard('oidc') {
  handleRequest<T = any>(
    err: Error | null,
    user: T | false,
    info: unknown,
  ): T {
    if (err || !user) {
      throw err ?? new UnauthorizedException(String(info) || 'OIDC auth failed');
    }
    return user;
  }

  getRequest(context: ExecutionContext) {
    return context.switchToHttp().getRequest();
  }
}
