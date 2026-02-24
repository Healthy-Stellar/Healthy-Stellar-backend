import { Module, Global } from '@nestjs/common';
import { MedicalCacheService } from './medical-cache.service';
import { PatientCacheService } from './patient-cache.service';
import { RealTimeDataService } from './real-time-data.service';
import { CacheWarmupService } from './cache-warmup.service';

@Global()
@Module({
  providers: [MedicalCacheService, PatientCacheService, RealTimeDataService, CacheWarmupService],
  exports: [MedicalCacheService, PatientCacheService, RealTimeDataService, CacheWarmupService],
})
export class MedicalCacheModule {}
