import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { MfaService } from '../services/mfa.service';
import { JwtPayload } from '../services/auth-token.service';

@Injectable()
export class MfaVerifiedGuard implements CanActivate {
  constructor(private mfaService: MfaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user: JwtPayload = request.user;

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Check if user has MFA enabled
    const mfaEnabled = await this.mfaService.isMfaEnabled(user.userId);

    // `mfaVerified` is the session-scoped JWT claim; `mfaEnabled` here is the
    // account-level setting looked up from the database.
    if (mfaEnabled && user.mfaVerified !== true) {
      throw new UnauthorizedException('MFA verification required');
    }

    return true;
  }
}
