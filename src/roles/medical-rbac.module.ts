import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MedicalRbacController } from './controllers/medical-rbac.controller';
import { RoleTemplateController } from './controllers/role-template.controller';
import { EmergencyOverride } from './entities/emergency-override.entity';
import { MedicalAuditLog } from './entities/medical-audit-log.entity';
import { RoleTemplate } from './entities/role-template.entity';
import { MedicalRbacGuard } from './guards/medical-rbac.guard';
import { EmergencyOverrideService } from './services/emergency-override.service';
import { MedicalAuditService } from './services/medical-audit.service';
import { MedicalPermissionsService } from './services/medical-permissions.service';
import { RoleTemplateService } from './services/role-template.service';

@Module({
  imports: [TypeOrmModule.forFeature([MedicalAuditLog, EmergencyOverride, RoleTemplate])],
  controllers: [MedicalRbacController, RoleTemplateController],
  providers: [
    MedicalPermissionsService,
    MedicalAuditService,
    EmergencyOverrideService,
    RoleTemplateService,
    MedicalRbacGuard,
  ],
  exports: [
    MedicalPermissionsService,
    MedicalAuditService,
    EmergencyOverrideService,
    RoleTemplateService,
    MedicalRbacGuard,
  ],
})
export class MedicalRbacModule {}
