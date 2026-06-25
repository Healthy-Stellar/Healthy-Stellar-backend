import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FEATURE_FLAG_KEY } from './feature-flag.decorator';
import { FeatureFlagService } from './feature-flag.service';

@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly featureFlagService: FeatureFlagService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const flagKey = this.reflector.getAllAndOverride<string>(FEATURE_FLAG_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!flagKey) return true;

    const request = context.switchToHttp().getRequest();
    const actorId: string | undefined = request.user?.id ?? request.user?.sub;
    const tenantId: string | undefined =
      request.user?.tenantId ??
      request.headers['x-tenant-id'] ??
      undefined;

    const enabled = await this.featureFlagService.isEnabled(flagKey, { actorId, tenantId });
    if (!enabled) {
      throw new ForbiddenException(`Feature '${flagKey}' is not available`);
    }
    return true;
  }
}
