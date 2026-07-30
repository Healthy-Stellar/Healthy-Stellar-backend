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
  Remittance,
  BillingDispute,
} from './entities';

import {
  MedicalCodeService,
  InsuranceService,
  BillingService,
  ClaimService,
  PaymentService,
  DenialService,
  ReportService,
  InvoicePdfService,
  RemittanceService,
  DisputeService,
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
  RemittanceController,
  DisputeController,
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
      Remittance,
      BillingDispute,
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
    RemittanceController,
    DisputeController,
  ],
  providers: [
    MedicalCodeService,
    InsuranceService,
    BillingService,
    ClaimService,
    PaymentService,
    DenialService,
    ReportService,
    InvoicePdfService,
    RemittanceService,
    DisputeService,
  ],
  exports: [
    MedicalCodeService,
    InsuranceService,
    BillingService,
    ClaimService,
    PaymentService,
    DenialService,
    ReportService,
    InvoicePdfService,
    RemittanceService,
    DisputeService,
  ],
})
export class BillingModule {}
