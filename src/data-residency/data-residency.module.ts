import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { dataResidencyConfig, validateDataResidencyConfig } from './config/data-residency.config';
import { DataResidencyService } from './services/data-residency.service';
import { RegionalDatabaseService } from './services/regional-database.service';
import { RegionalIpfsService } from './services/regional-ipfs.service';
import { RegionalHorizonService } from './services/regional-horizon.service';
import { DataResidencyGuard } from './guards/data-residency.guard';
import { DataRegionHeaderInterceptor } from './interceptors/data-region-header.interceptor';
import { DataResidencyController } from './controllers/data-residency.controller';
import { TenantDatabaseRoutingService } from '../database/tenant-database-routing.service';

@Module({
  imports: [
    ConfigModule.forFeature(dataResidencyConfig),
    ConfigModule.forRoot({ validate: validateDataResidencyConfig }),
  ],
  providers: [
    DataResidencyService,
    RegionalDatabaseService,
    RegionalIpfsService,
    RegionalHorizonService,
    DataResidencyGuard,
    DataRegionHeaderInterceptor,
    TenantDatabaseRoutingService,
  ],
  controllers: [DataResidencyController],
  exports: [
    DataResidencyService,
    RegionalDatabaseService,
    RegionalIpfsService,
    RegionalHorizonService,
    DataResidencyGuard,
    DataRegionHeaderInterceptor,
    TenantDatabaseRoutingService,
  ],
})
export class DataResidencyModule {}
