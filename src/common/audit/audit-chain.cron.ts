import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AuditChainService } from './audit-chain.service';

@Injectable()
export class AuditChainCron {
  private readonly logger = new Logger(AuditChainCron.name);

  constructor(private readonly auditChainService: AuditChainService) {}

  /**
   * Run every hour to check and anchor the hash chain to Stellar.
   * Anchors when either 1000 new entries exist or 1 hour has passed since the last anchor.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async anchorChain(): Promise<void> {
    this.logger.log('Running scheduled audit chain anchoring check...');
    try {
      const result = await this.auditChainService.checkAndAnchor();
      if (result) {
        this.logger.log(`Audit chain anchored: txHash=${result.txHash}, rootHash=${result.rootHash}`);
      } else {
        this.logger.log('Audit chain anchoring not needed yet');
      }
    } catch (error: any) {
      this.logger.error(`Failed to anchor audit chain: ${error.message}`, error.stack);
    }
  }
}
