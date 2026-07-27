import { Module } from '@nestjs/common';
import { HospitalConfigurationModule } from './src/hospital-configuration/hospital-configuration.module';

@Module({
  imports: [HospitalConfigurationModule],
})
export class AppModule {}
