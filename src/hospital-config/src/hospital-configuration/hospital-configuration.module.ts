import { Module } from '@nestjs/common';
import { HospitalConfigurationController } from '../../hospital-configuration.controller';
import { HospitalConfigurationService } from '../../hospital-configuration.service';
import { TimezoneService } from '../../timezone.service';

@Module({
  controllers: [HospitalConfigurationController],
  providers: [HospitalConfigurationService, TimezoneService],
  exports: [HospitalConfigurationService, TimezoneService],
})
export class HospitalConfigurationModule {}
