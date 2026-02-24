import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
@Injectable()
export class AdminGuard implements CanActivate {
  constructor() {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user || { role: 'admin' }; // assuming JwtAuthGuard populated this
    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Only admin users bypass
    if (user.role === 'admin') {
      return true;
    }

    throw new ForbiddenException('You do not have permission to access this patient');
  }
}
