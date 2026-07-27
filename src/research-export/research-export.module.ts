import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MedicalRecord } from '../medical-records/entities/medical-record.entity';
import { Patient } from '../patients/entities/patient.entity';
import { AccessGrant } from '../access-control/entities/access-grant.entity';
import { AuditModule } from '../common/audit/audit.module';
import { MedicalRbacModule } from '../roles/medical-rbac.module';
import { ResearchExportController } from './research-export.controller';
import { ResearchExportService } from './research-export.service';
import { ResearchAnonymizerService } from './research-anonymizer.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([MedicalRecord, Patient, AccessGrant]),
    AuditModule,
    MedicalRbacModule,
  ],
  controllers: [ResearchExportController],
  providers: [ResearchExportService, ResearchAnonymizerService],
  exports: [ResearchExportService, ResearchAnonymizerService],
})
export class ResearchExportModule {}
