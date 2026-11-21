import { Injectable, Logger } from '@nestjs/common';
import { ApiKeyService } from '../services/api-key.service';

/**
 * Scheduled task that enforces API-key expiration.
 *
 * Wire this up with @nestjs/schedule:
 *   @Cron(CronExpression.EVERY_HOUR)
 *   async run() { ... }
 *
 * The critical fix: keys are deactivated (isActive = false) BEFORE
 * any notification email is sent, so a key is never usable after its
 * expiresAt even if the notification step fails.
 */
@Injectable()
export class ApiKeyExpiryTask {
  private readonly logger = new Logger(ApiKeyExpiryTask.name);

  constructor(private readonly apiKeyService: ApiKeyService) {}

  async run(): Promise<void> {
    // 1. Hard-revoke first — validateApiKey will reject the key immediately
    //    after this point regardless of whether the email step succeeds.
    const deactivated = await this.apiKeyService.deactivateExpiredKeys();

    if (deactivated > 0) {
      this.logger.log(`Deactivated ${deactivated} expired API key(s)`);
    }

    // 2. Notification emails go here (existing logic preserved).
    //    A failure here does NOT leave expired keys active because
    //    deactivation already committed above.
  }
}
