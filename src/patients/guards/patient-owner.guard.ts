import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

@Injectable()
export class PatientOwnerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const address = request.params?.address;

    if (!user) throw new ForbiddenException('User not authenticated');
    if (user.role === 'admin') return true;
    if (user.stellarAddress && user.stellarAddress === address) return true;

    throw new ForbiddenException('You can only update your own profile');
  }
}
