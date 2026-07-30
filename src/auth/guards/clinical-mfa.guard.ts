import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';

@Injectable()
export class ClinicalMfaGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const path = (request.originalUrl || request.url || '').toString();
    const isClinicalRoute =
      path.startsWith('/medical-records') ||
      path.startsWith('/pharmacy') ||
      path.startsWith('/laboratory') ||
      path.startsWith('/patients');

    if (!isClinicalRoute) {
      return true;
    }

    const user = request.user as { userId?: string; role?: string } | undefined;
    if (!user?.userId) {
      throw new UnauthorizedException('Authentication required');
    }

    const dbUser = await this.userRepository.findOne({ where: { id: user.userId } });
    if (!dbUser) {
      throw new UnauthorizedException('User not found');
    }

    const normalizedRole = (dbUser.role || '').toString().toLowerCase();
    if (!this.isClinicalRole(normalizedRole)) {
      return true;
    }

    if (!dbUser.mfaEnabled) {
      throw new UnauthorizedException('MFA verification required');
    }

    return true;
  }

  private isClinicalRole(role: string): boolean {
    const clinicalRoles = [
      'doctor',
      'physician',
      'nurse',
      'pharmacist',
      'lab_technician',
      'lab technician',
      'medical_records',
    ];

    return clinicalRoles.includes(role);
  }
}
