import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TenantQuota } from './entities/tenant-quota.entity';
import { TenantQuotaService } from './services/tenant-quota.service';
import { QuotaGuard } from './guards/quota.guard';
import { TenantQuotaAdminController } from './controllers/tenant-quota-admin.controller';

/**
 * Self-contained module for tenant-level resource quota management.
 *
 * Import this module into `AppModule` (or any feature module that needs
 * quota enforcement):
 *
 * ```ts
 * // src/app.module.ts
 * import { TenantQuotaModule } from './tenant-quota/tenant-quota.module';
 *
 * @Module({
 *   imports: [
 *     // … existing imports …
 *     TenantQuotaModule,
 *   ],
 * })
 * export class AppModule {}
 * ```
 *
 * The module assumes:
 * 1. `TypeOrmModule.forRoot(…)` is configured in `AppModule`.
 * 2. An IORedis-compatible Redis provider is registered globally
 *    (e.g. via `@nestjs-modules/ioredis` or a custom `RedisModule`).
 * 3. Your Redis module exports an `@InjectRedis()` token.
 */
@Module({
  imports: [TypeOrmModule.forFeature([TenantQuota])],
  providers: [TenantQuotaService, QuotaGuard],
  controllers: [TenantQuotaAdminController],
  exports: [TenantQuotaService, QuotaGuard],
})
export class TenantQuotaModule {}