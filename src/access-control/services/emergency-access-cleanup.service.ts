import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { AccessControlService } from './access-control.service';

@Injectable()
export class EmergencyAccessCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmergencyAccessCleanupService.name);
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(private readonly accessControlService: AccessControlService) {}

  onModuleInit(): void {
    this.cleanupInterval = setInterval(async () => {
      try {
        const expired = await this.accessControlService.expireEmergencyGrants();
        if (expired > 0) {
          this.logger.log(`Emergency cleanup expired ${expired} grants`);
        }
      } catch (error) {
        this.logger.error('Emergency grant cleanup failed', error instanceof Error ? error.stack : undefined);
      }
    }, 15 * 60 * 1000);
  }

  onModuleDestroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}
