import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { GuardianService } from '../services/guardian.service';

@Injectable()
export class GuardianAgeOutTask {
  private readonly logger = new Logger(GuardianAgeOutTask.name);

  constructor(private readonly guardianService: GuardianService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleAgeOut(): Promise<void> {
    const count = await this.guardianService.expireAgedOutGuardianships();
    this.logger.log(`Guardian age-out task completed: ${count} links updated`);
  }
}
