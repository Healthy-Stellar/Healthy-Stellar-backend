import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { TenantConfig } from './entities/tenant-config.entity';
import { TenantBranding } from './entities/tenant-branding.entity';
import { TenantConfigService } from './services/tenant-config.service';
import { TenantBrandingService } from './services/tenant-branding.service';
import { TenantConfigController } from './controllers/tenant-config.controller';
import { TenantBrandingController } from './controllers/tenant-branding.controller';
import { FeatureFlagGuard } from './guards/feature-flag.guard';
import { TenantIpAllowlistGuard } from './guards/tenant-ip-allowlist.guard';
import { CommonModule } from '../common/common.module';

@Global()
@Module({
feat/tenant-branding
  imports: [
    TypeOrmModule.forFeature([TenantConfig, TenantBranding]),
    MulterModule.register({ limits: { fileSize: 2 * 1024 * 1024 } }),
    CommonModule,
  ],
  controllers: [TenantConfigController, TenantBrandingController],
  providers: [TenantConfigService, TenantBrandingService, FeatureFlagGuard],
  exports: [TenantConfigService, TenantBrandingService, FeatureFlagGuard],

  imports: [TypeOrmModule.forFeature([TenantConfig]), CommonModule],
  controllers: [TenantConfigController],
  providers: [TenantConfigService, FeatureFlagGuard, TenantIpAllowlistGuard],
  exports: [TenantConfigService, FeatureFlagGuard, TenantIpAllowlistGuard],
main
})
export class TenantConfigModule {}
