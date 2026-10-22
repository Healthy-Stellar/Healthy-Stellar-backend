import { Injectable, Logger } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { AuditLog } from '../../common/entities/audit-log.entity';

export interface DeletionHandler {
  moduleName: string;
  deleteForUser: (userId: string, manager: EntityManager) => Promise<void>;
  /** Dry-run: returns how many rows would be deleted/anonymised for this user, without writing anything. */
  previewForUser?: (userId: string, manager: EntityManager) => Promise<number>;
}

export interface DeletionPreviewEntry {
  moduleName: string;
  estimatedCount: number | null;
}

@Injectable()
export class DeletionRegistryService {
  private readonly logger = new Logger(DeletionRegistryService.name);
  private readonly handlers: DeletionHandler[] = [];

  constructor(private readonly dataSource: DataSource) {}

  register(handler: DeletionHandler): void {
    this.handlers.push(handler);
    this.logger.log(`DeletionRegistry: registered handler for module "${handler.moduleName}"`);
  }

  getRegisteredModules(): string[] {
    return this.handlers.map((h) => h.moduleName);
  }

  /** Dry-run mode: reports what each registered module *would* delete/anonymise, without mutating anything. */
  async previewForUser(userId: string): Promise<DeletionPreviewEntry[]> {
    const preview: DeletionPreviewEntry[] = [];

    for (const handler of this.handlers) {
      if (!handler.previewForUser) {
        preview.push({ moduleName: handler.moduleName, estimatedCount: null });
        continue;
      }

      try {
        const estimatedCount = await handler.previewForUser(userId, this.dataSource.manager);
        preview.push({ moduleName: handler.moduleName, estimatedCount });
      } catch (error) {
        this.logger.error(
          `DeletionRegistry: preview for "${handler.moduleName}" failed for user ${userId}: ${error.message}`,
        );
        preview.push({ moduleName: handler.moduleName, estimatedCount: null });
      }
    }

    return preview;
  }

  async deleteAllForUser(userId: string): Promise<void> {
    this.logger.log(
      `DeletionRegistry: running ${this.handlers.length} handlers for user ${userId}`,
    );

    await this.dataSource.transaction(async (manager) => {
      for (const handler of this.handlers) {
        try {
          await handler.deleteForUser(userId, manager);
          this.logger.log(`DeletionRegistry: "${handler.moduleName}" completed for user ${userId}`);
          await this.recordStep(manager, handler.moduleName, userId, 'success');
        } catch (error) {
          this.logger.error(
            `DeletionRegistry: handler "${handler.moduleName}" failed for user ${userId}: ${error.message}`,
          );
          // Recorded on a separate (non-transactional) connection so the failure is
          // still visible in the audit trail even though the transaction rolls back.
          await this.recordStep(
            this.dataSource.manager,
            handler.moduleName,
            userId,
            'failed',
            error.message,
          );
          throw error;
        }
      }
    });

    this.logger.log(`DeletionRegistry: all handlers completed for user ${userId}`);
  }

  private async recordStep(
    manager: EntityManager,
    moduleName: string,
    userId: string,
    status: 'success' | 'failed',
    errorMessage?: string,
  ): Promise<void> {
    const entry = manager.create(AuditLog, {
      operation: 'GDPR_ERASURE_CASCADE_STEP',
      entityType: moduleName,
      userId,
      status,
      errorMessage,
    });
    await manager.save(AuditLog, entry);
  }
}
