import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BullModule } from "@nestjs/bull";
import { Tenant } from "./entities/tenant.entity";
import { ProvisioningLog } from "./entities/provisioning-log.entity";
import { TenantsController } from "./controllers/tenants.controller";
import { ProvisioningService } from "./services/provisioning.service";
import { DatabaseService } from "./services/database.service";
import { SorobanService } from "./services/soroban.service";
import { EmailService } from "./services/email.service";
import { ProvisioningProcessor } from "./processors/provisioning.processor";

@Module({
  imports: [
    TypeOrmModule.forFeature([Tenant, ProvisioningLog]),
    BullModule.registerQueue({
      name: "provisioning",
      settings: {
        maxStalledCount: 2,
        stalledInterval: 5000,
      },
    }),
  ],
  controllers: [TenantsController],
  providers: [
    ProvisioningService,
    DatabaseService,
    SorobanService,
    EmailService,
    ProvisioningProcessor,
  ],
  exports: [ProvisioningService],
})
export class TenantsModule {}
