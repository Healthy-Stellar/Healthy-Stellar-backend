import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TreatmentPlan } from './entities/treatment-plan.entity';
import { TreatmentPlanVersion } from './entities/treatment-plan-version.entity';
import { MedicalProcedure } from './entities/medical-procedure.entity';
import { CarePlanTemplate } from './entities/care-plan-template.entity';
import { TreatmentOutcome } from './entities/treatment-outcome.entity';
import { ClinicalGuideline } from './entities/clinical-guideline.entity';
import { DecisionSupportAlert } from './entities/decision-support-alert.entity';
import { Diagnosis } from '../diagnosis/entities/diagnosis.entity';
import { TreatmentPlanService } from './services/treatment-plan.service';
import { MedicalProcedureService } from './services/medical-procedure.service';
import { CarePlanTemplateService } from './services/care-plan-template.service';
import { TreatmentOutcomeService } from './services/treatment-outcome.service';
import { DecisionSupportService } from './services/decision-support.service';
import {
  TreatmentPlanController,
  MedicalProcedureController,
  CarePlanTemplateController,
  TreatmentOutcomeController,
  DecisionSupportController,
} from './controllers/treatment-planning.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TreatmentPlan,
      TreatmentPlanVersion,
      MedicalProcedure,
      CarePlanTemplate,
      TreatmentOutcome,
      ClinicalGuideline,
      DecisionSupportAlert,
      Diagnosis,
    ]),
  ],
  controllers: [
    TreatmentPlanController,
    MedicalProcedureController,
    CarePlanTemplateController,
    TreatmentOutcomeController,
    DecisionSupportController,
  ],
  providers: [
    TreatmentPlanService,
    MedicalProcedureService,
    CarePlanTemplateService,
    TreatmentOutcomeService,
    DecisionSupportService,
  ],
  exports: [
    TreatmentPlanService,
    MedicalProcedureService,
    CarePlanTemplateService,
    TreatmentOutcomeService,
    DecisionSupportService,
  ],
})
export class TreatmentPlanningModule {}
