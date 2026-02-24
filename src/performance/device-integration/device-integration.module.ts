import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeviceIntegrationService } from './device-integration.service';
import { DevicePerformanceService } from './device-performance.service';
import { MedicalDevice } from './entities/medical-device.entity';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([MedicalDevice])],
  providers: [DeviceIntegrationService, DevicePerformanceService],
  exports: [DeviceIntegrationService, DevicePerformanceService],
})
export class DeviceIntegrationModule {}
