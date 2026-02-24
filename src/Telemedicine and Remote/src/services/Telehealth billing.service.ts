import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { TelehealthBilling, BillingStatus, PayerType } from '../entities/telehealth-billing.entity';

export interface CreateBillingDto {
  patientId: string;
  providerId: string;
  virtualVisitId: string;
  documentId?: string;
  serviceDate: Date;
  cptCodes: any[];
  diagnosisCodes: any[];
  payerType: PayerType;
  insuranceCompany?: string;
  policyNumber?: string;
  durationMinutes?: number;
}

@Injectable()
export class TelehealthBillingService {
  constructor(
    @InjectRepository(TelehealthBilling)
    private billingRepository: Repository<TelehealthBilling>,
  ) {}

  async createBilling(dto: CreateBillingDto): Promise<TelehealthBilling> {
    // Validate CPT codes for telemedicine
    this.validateTelemedicineCodes(dto.cptCodes);

    // Calculate charges
    const totalCharges = dto.cptCodes.reduce((sum, cpt) => sum + cpt.totalPrice, 0);

    // Validate compliance
    const complianceChecks = this.performComplianceChecks(dto);

    const billing = this.billingRepository.create({
      ...dto,
      placeOfService: '02', // Telemedicine code
      totalCharges,
      balanceDue: totalCharges,
      status: BillingStatus.PENDING,
      isTelemedicineCompliant: complianceChecks.isCompliant,
      complianceChecks: complianceChecks.checks,
    });

    return this.billingRepository.save(billing);
  }

  async submitClaim(billingId: string): Promise<TelehealthBilling> {
    const billing = await this.findOne(billingId);

    if (billing.status !== BillingStatus.PENDING) {
      throw new BadRequestException('Claim has already been submitted');
    }

    // Validate all required fields
    this.validateClaimSubmission(billing);

    // Generate claim number
    const claimNumber = this.generateClaimNumber();

    billing.status = BillingStatus.SUBMITTED;
    billing.claimNumber = claimNumber;
    billing.claimSubmittedDate = new Date();

    // In production: Submit to clearinghouse or payer
    // await this.clearinghouseService.submitClaim(billing);

    return this.billingRepository.save(billing);
  }

  async approveClaim(
    billingId: string,
    insurancePayment: number,
    patientResponsibility: number,
  ): Promise<TelehealthBilling> {
    const billing = await this.findOne(billingId);

    const adjustments = billing.totalCharges - insurancePayment - patientResponsibility;

    billing.status = BillingStatus.APPROVED;
    billing.insurancePayment = insurancePayment;
    billing.patientResponsibility = patientResponsibility;
    billing.adjustments = adjustments;
    billing.balanceDue = patientResponsibility;

    return this.billingRepository.save(billing);
  }

  async denyClaim(
    billingId: string,
    denialReason: string,
    denialCodes: string[],
  ): Promise<TelehealthBilling> {
    const billing = await this.findOne(billingId);

    billing.status = BillingStatus.DENIED;
    billing.denialReason = denialReason;
    billing.denialCodes = denialCodes;

    return this.billingRepository.save(billing);
  }

  async appealClaim(billingId: string, appealReason: string): Promise<TelehealthBilling> {
    const billing = await this.findOne(billingId);

    if (billing.status !== BillingStatus.DENIED) {
      throw new BadRequestException('Only denied claims can be appealed');
    }

    billing.status = BillingStatus.APPEALED;
    billing.isAppealed = true;
    billing.appealDate = new Date();
    billing.appealReason = appealReason;

    return this.billingRepository.save(billing);
  }

  async recordPayment(
    billingId: string,
    amount: number,
    paymentMethod: string,
    paidBy: 'insurance' | 'patient',
    transactionId?: string,
  ): Promise<TelehealthBilling> {
    const billing = await this.findOne(billingId);

    const paymentHistory = billing.paymentHistory || [];
    paymentHistory.push({
      date: new Date(),
      amount,
      paymentMethod,
      transactionId,
      paidBy,
    });

    billing.paymentHistory = paymentHistory;
    billing.amountPaid += amount;
    billing.balanceDue -= amount;

    if (billing.balanceDue <= 0) {
      billing.status = BillingStatus.PAID;
      billing.paymentDate = new Date();
    } else if (billing.amountPaid > 0) {
      billing.status = BillingStatus.PARTIALLY_PAID;
    }

    return this.billingRepository.save(billing);
  }

  async getPatientBilling(patientId: string): Promise<TelehealthBilling[]> {
    return this.billingRepository.find({
      where: { patientId },
      order: { serviceDate: 'DESC' },
    });
  }

  async getProviderBilling(
    providerId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<TelehealthBilling[]> {
    const whereClause: any = { providerId };

    if (startDate && endDate) {
      whereClause.serviceDate = Between(startDate, endDate);
    }

    return this.billingRepository.find({
      where: whereClause,
      order: { serviceDate: 'DESC' },
    });
  }

  async getOutstandingClaims(): Promise<TelehealthBilling[]> {
    return this.billingRepository.find({
      where: [{ status: BillingStatus.SUBMITTED }, { status: BillingStatus.APPEALED }],
      order: { claimSubmittedDate: 'ASC' },
    });
  }

  async generateRevenueReport(providerId: string, startDate: Date, endDate: Date): Promise<any> {
    const billings = await this.getProviderBilling(providerId, startDate, endDate);

    const report = {
      period: { startDate, endDate },
      totalClaims: billings.length,
      totalCharges: 0,
      totalPayments: 0,
      totalAdjustments: 0,
      outstandingBalance: 0,
      claimsByStatus: {},
      payerBreakdown: {},
      averageReimbursementRate: 0,
    };

    billings.forEach((billing) => {
      report.totalCharges += Number(billing.totalCharges);
      report.totalPayments += Number(billing.amountPaid);
      report.totalAdjustments += Number(billing.adjustments);
      report.outstandingBalance += Number(billing.balanceDue);

      // Count by status
      report.claimsByStatus[billing.status] = (report.claimsByStatus[billing.status] || 0) + 1;

      // Sum by payer type
      if (!report.payerBreakdown[billing.payerType]) {
        report.payerBreakdown[billing.payerType] = {
          count: 0,
          charges: 0,
          payments: 0,
        };
      }
      report.payerBreakdown[billing.payerType].count++;
      report.payerBreakdown[billing.payerType].charges += Number(billing.totalCharges);
      report.payerBreakdown[billing.payerType].payments += Number(billing.amountPaid);
    });

    report.averageReimbursementRate =
      report.totalCharges > 0 ? (report.totalPayments / report.totalCharges) * 100 : 0;

    return report;
  }

  async validateTelemedicineEligibility(
    patientId: string,
    insuranceCompany: string,
    policyNumber: string,
  ): Promise<{ isEligible: boolean; coverageDetails?: any; message?: string }> {
    // In production: Call insurance verification API
    // This is a simplified example

    // Simulate eligibility check
    const isEligible = true;

    return {
      isEligible,
      coverageDetails: {
        telemedicineAllowed: true,
        copay: 25,
        coinsurance: 20,
        deductible: 500,
        deductibleMet: 300,
      },
      message: 'Patient is eligible for telemedicine services',
    };
  }

  private validateTelemedicineCodes(cptCodes: any[]): void {
    // Common telemedicine CPT codes
    const validTelemedicineCodes = [
      '99441',
      '99442',
      '99443', // Telephone E/M
      '99421',
      '99422',
      '99423', // Online digital E/M
      '99201',
      '99202',
      '99203',
      '99204',
      '99205', // New patient E/M (with modifier)
      '99211',
      '99212',
      '99213',
      '99214',
      '99215', // Established patient E/M (with modifier)
    ];

    cptCodes.forEach((cpt) => {
      // Check if code exists or has proper modifier
      const hasTelemedicineModifier = cpt.modifier?.includes('95') || cpt.modifier?.includes('GT');
      const isTelemedicineCode = validTelemedicineCodes.includes(cpt.code);

      if (!isTelemedicineCode && !hasTelemedicineModifier) {
        throw new BadRequestException(
          `CPT code ${cpt.code} requires telemedicine modifier (95 or GT)`,
        );
      }
    });
  }

  private performComplianceChecks(dto: CreateBillingDto): {
    isCompliant: boolean;
    checks: any;
  } {
    const checks = {
      originatingSiteDocumented: true,
      distantSiteDocumented: true,
      consentObtained: true,
      appropriateModifiersUsed: true,
      stateLicenseVerified: true,
    };

    // Verify modifiers
    const hasProperModifiers = dto.cptCodes.every(
      (cpt) => cpt.modifier && (cpt.modifier.includes('95') || cpt.modifier.includes('GT')),
    );
    checks.appropriateModifiersUsed = hasProperModifiers;

    const isCompliant = Object.values(checks).every((check) => check === true);

    return { isCompliant, checks };
  }

  private validateClaimSubmission(billing: TelehealthBilling): void {
    if (!billing.cptCodes || billing.cptCodes.length === 0) {
      throw new BadRequestException('CPT codes are required');
    }

    if (!billing.diagnosisCodes || billing.diagnosisCodes.length === 0) {
      throw new BadRequestException('Diagnosis codes are required');
    }

    if (billing.payerType === PayerType.INSURANCE && !billing.insuranceCompany) {
      throw new BadRequestException('Insurance company is required');
    }

    if (!billing.isTelemedicineCompliant) {
      throw new BadRequestException('Billing does not meet telemedicine compliance requirements');
    }
  }

  private generateClaimNumber(): string {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    return `CLM-${timestamp}-${random}`;
  }

  async findOne(id: string): Promise<TelehealthBilling> {
    const billing = await this.billingRepository.findOne({ where: { id } });

    if (!billing) {
      throw new NotFoundException(`Billing record with ID ${id} not found`);
    }

    return billing;
  }

  async updateBilling(id: string, updates: Partial<TelehealthBilling>): Promise<TelehealthBilling> {
    const billing = await this.findOne(id);

    Object.assign(billing, updates);

    return this.billingRepository.save(billing);
  }
}
