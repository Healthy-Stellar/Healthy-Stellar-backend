import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { UserRole } from '../entities/user.entity';
import { JwtPayload } from '../services/auth-token.service';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user: JwtPayload = request.user;

    // Handle unauthenticated requests (401)
    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    // Verify user.role === 'ADMIN' (403 if not admin)
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Admin access required');
    }

    return true;
  }
}
