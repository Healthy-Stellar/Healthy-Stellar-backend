import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MedicalRecord } from '../medical-records/entities/medical-record.entity';
import { Patient } from '../patients/entities/patient.entity';
import { AccessGrant } from '../access-control/entities/access-grant.entity';
import { AuditModule } from '../common/audit/audit.module';
import { ResearchExportService } from './research-export.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([MedicalRecord, Patient, AccessGrant]),
    AuditModule,
  ],
  providers: [ResearchExportService],
  exports: [ResearchExportService],
})
export class ResearchExportModule {}
