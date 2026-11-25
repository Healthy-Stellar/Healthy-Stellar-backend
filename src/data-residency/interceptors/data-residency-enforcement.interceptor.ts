import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { DataResidencyGuard } from '../guards/data-residency.guard';

/**
 * Applies DataResidencyGuard to every route. Global guards run before route guards,
 * so request.user (set by JwtAuthGuard) is empty there. Interceptors run after guards,
 * so the tenant check sees the authenticated principal.
 */
@Injectable()
export class DataResidencyEnforcementInterceptor implements NestInterceptor {
  constructor(private readonly guard: DataResidencyGuard) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    await this.guard.canActivate(context);
    return next.handle();
  }
}
