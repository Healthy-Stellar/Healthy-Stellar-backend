import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DataResidencyService } from './services/data-residency.service';
import { RegionalDatabaseService } from './services/regional-database.service';
import { RegionalIpfsService } from './services/regional-ipfs.service';
import { RegionalHorizonService } from './services/regional-horizon.service';
import { DataResidencyGuard } from './guards/data-residency.guard';
import { DataRegionHeaderInterceptor } from './interceptors/data-region-header.interceptor';
import { DataResidencyController } from './controllers/data-residency.controller';

/**
 * Data Residency Module
 * Manages region-aware infrastructure for multi-region deployments
 * Ensures compliance with regional data protection regulations
 */
@Module({
  imports: [ConfigModule],
  providers: [
    DataResidencyService,
    RegionalDatabaseService,
    RegionalIpfsService,
    RegionalHorizonService,
    DataResidencyGuard,
    DataRegionHeaderInterceptor,
  ],
  controllers: [DataResidencyController],
  exports: [
    DataResidencyService,
    RegionalDatabaseService,
    RegionalIpfsService,
    RegionalHorizonService,
    DataResidencyGuard,
    DataRegionHeaderInterceptor,
  ],
})
export class DataResidencyModule {}
