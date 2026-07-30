import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Diagnosis } from './entities/diagnosis.entity';
import { DiagnosisHistory } from './entities/diagnosis-history.entity';
import { Icd11Code } from './entities/icd11-code.entity';
import { DiagnosisService } from './services/diagnosis.service';
import { Icd11Service } from './services/icd11.service';
import { DiagnosisController } from './controllers/diagnosis.controller';
import { BillingModule } from '../billing/billing.module';
import { TreatmentPlan } from '../treatment-planning/entities/treatment-plan.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Diagnosis, DiagnosisHistory, Icd11Code, TreatmentPlan]),
    BillingModule, // For MedicalCodeService
  ],
  controllers: [DiagnosisController],
  providers: [DiagnosisService, Icd11Service],
  exports: [DiagnosisService, Icd11Service],
})
export class DiagnosisModule {}
