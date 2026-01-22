import { Module } from "@nestjs/common";
import { HospitalConfigurationController } from "./hospital-configuration.controller";
import { HospitalConfigurationService } from "./hospital-configuration.service";

@Module({
  controllers: [HospitalConfigurationController],
  providers: [HospitalConfigurationService],
  exports: [HospitalConfigurationService],
})
export class HospitalConfigurationModule {}
