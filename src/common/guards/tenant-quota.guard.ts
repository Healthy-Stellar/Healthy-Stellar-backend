import {
  CanActivate,
  ExecutionContext,
  Injectable,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { TenantQuotaService } from '../../tenant-quota/tenant-quota.service';
import { NotificationsService } from '../../notifications/notifications.service';

@Injectable()
export class TenantQuotaGuard implements CanActivate {
  constructor(
    private readonly quotaService: TenantQuotaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    
    // Extract tenant context (Assumes tenant context is populated by an upstream Auth/Tenant Guard)
    const tenantId = request.user?.tenantId || request.headers['x-tenant-id'];
    
    if (!tenantId) {
      return true; // Bypass or throw 400 depending on multi-tenancy strategy
    }

    // 1. Fetch cached Redis quota info
    const { currentUsage, maxQuota } = await this.quotaService.getTenantQuotaStatus(tenantId);

    // 2. Check if limit is already reached or exceeded
    if (currentUsage >= maxQuota) {
      throw new HttpException(
        {
          statusCode: HttpStatus.PAYMENT_REQUIRED,
          error: 'Payment Required',
          message: 'Storage quota exceeded. Please upgrade your subscription plan to resume writes.',
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    // 3. Asynchronously evaluate warning thresholds
    this.evaluateThresholdWarnings(tenantId, currentUsage, maxQuota);

    return true;
  }

  private async evaluateThresholdWarnings(tenantId: string, current: number, max: number): Promise<void> {
    const usagePercentage = (current / max) * 100;

    if (usagePercentage >= 95) {
      await this.notificationsService.emitWarning(
        tenantId,
        `Critical: Your workspace has utilized ${usagePercentage.toFixed(1)}% of its allocated storage.`,
      );
    } else if (usagePercentage >= 80) {
      await this.notificationsService.emitWarning(
        tenantId,
        `Warning: Your workspace has utilized ${usagePercentage.toFixed(1)}% of its allocated storage.`,
      );
    }
  }
}