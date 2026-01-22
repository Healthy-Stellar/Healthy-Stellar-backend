import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import {
  MedicalCode,
  Insurance,
  InsuranceVerification,
  Billing,
  BillingLineItem,
  InsuranceClaim,
  Payment,
  ClaimDenial,
  ClaimAppeal,
  RevenueReport,
} from './entities';

import {
  MedicalCodeService,
  InsuranceService,
  BillingService,
  ClaimService,
  PaymentService,
  DenialService,
  ReportService,
} from './services';

import {
  MedicalCodeController,
  InsuranceController,
  BillingController,
  ClaimController,
  PaymentController,
  DenialController,
  AppealController,
  ReportController,
} from './controllers';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MedicalCode,
      Insurance,
      InsuranceVerification,
      Billing,
      BillingLineItem,
      InsuranceClaim,
      Payment,
      ClaimDenial,
      ClaimAppeal,
      RevenueReport,
    ]),
  ],
  controllers: [
    MedicalCodeController,
    InsuranceController,
    BillingController,
    ClaimController,
    PaymentController,
    DenialController,
    AppealController,
    ReportController,
  ],
  providers: [
    MedicalCodeService,
    InsuranceService,
    BillingService,
    ClaimService,
    PaymentService,
    DenialService,
    ReportService,
  ],
  exports: [
    MedicalCodeService,
    InsuranceService,
    BillingService,
    ClaimService,
    PaymentService,
    DenialService,
    ReportService,
  ],
})
export class BillingModule {}
