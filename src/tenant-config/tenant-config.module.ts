import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantConfig } from './entities/tenant-config.entity';
import { TenantConfigService } from './services/tenant-config.service';
import { TenantConfigController } from './controllers/tenant-config.controller';
import { FeatureFlagGuard } from './guards/feature-flag.guard';
import { CommonModule } from '../common/common.module';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([TenantConfig]),
    CommonModule,
  ],
  controllers: [TenantConfigController],
  providers: [TenantConfigService, FeatureFlagGuard],
  exports: [TenantConfigService, FeatureFlagGuard],
})
export class TenantConfigModule {}
