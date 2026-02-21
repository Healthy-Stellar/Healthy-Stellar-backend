import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuditLogModule } from "./modules/audit-log/audit-log.module";
import { RecordsModule } from "./modules/records/records.module";
import { getTypeOrmConfig } from "./config/database.config";

@Module({
  imports: [
    TypeOrmModule.forRoot(getTypeOrmConfig()),
    AuditLogModule,
    RecordsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
