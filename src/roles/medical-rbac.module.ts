import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MedicalRbacController } from './controllers/medical-rbac.controller';
import { EmergencyOverride } from './entities/emergency-override.entity';
import { MedicalAuditLog } from './entities/medical-audit-log.entity';
import { MedicalRbacGuard } from './guards/medical-rbac.guard';
import { EmergencyOverrideService } from './services/emergency-override.service';
import { MedicalAuditService } from './services/medical-audit.service';
import { MedicalPermissionsService } from './services/medical-permissions.service';

@Module({
  imports: [TypeOrmModule.forFeature([MedicalAuditLog, EmergencyOverride])],
  controllers: [MedicalRbacController],
  providers: [
    MedicalPermissionsService,
    MedicalAuditService,
    EmergencyOverrideService,
    MedicalRbacGuard,
  ],
  exports: [
    MedicalPermissionsService,
    MedicalAuditService,
    EmergencyOverrideService,
    MedicalRbacGuard,
  ],
})
export class MedicalRbacModule {}
