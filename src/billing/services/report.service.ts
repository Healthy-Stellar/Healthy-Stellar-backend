import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThan, MoreThanOrEqual } from 'typeorm';
import { RevenueReport } from '../entities/revenue-report.entity';
import { Billing } from '../entities/billing.entity';
import { InsuranceClaim } from '../entities/insurance-claim.entity';
import { Payment } from '../entities/payment.entity';
import { ClaimDenial } from '../entities/claim-denial.entity';
import {
  GenerateReportDto,
  ReportType,
  PeriodType,
  ARAgingReportDto,
  DenialAnalysisDto,
} from '../dto/report.dto';
import { ClaimStatus, PaymentStatus } from '../../common/enums';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ReportService {
  constructor(
    @InjectRepository(RevenueReport)
    private readonly reportRepository: Repository<RevenueReport>,
    @InjectRepository(Billing)
    private readonly billingRepository: Repository<Billing>,
    @InjectRepository(InsuranceClaim)
    private readonly claimRepository: Repository<InsuranceClaim>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(ClaimDenial)
    private readonly denialRepository: Repository<ClaimDenial>,
  ) {}

  async generateReport(generateDto: GenerateReportDto): Promise<RevenueReport> {
    const startDate = new Date(generateDto.periodStart);
    const endDate = new Date(generateDto.periodEnd);

    const [billings, claims, payments, denials] = await Promise.all([
      this.billingRepository.find({
        where: { serviceDate: Between(startDate, endDate) },
        relations: ['lineItems', 'payments'],
      }),
      this.claimRepository.find({
        where: { serviceStartDate: Between(startDate, endDate) },
        relations: ['insurance'],
      }),
      this.paymentRepository.find({
        where: {
          paymentDate: Between(startDate, endDate),
          status: PaymentStatus.COMPLETED,
        },
      }),
      this.denialRepository.find({
        where: { denialDate: Between(startDate, endDate) },
      }),
    ]);

    const totalCharges = billings.reduce(
      (sum, b) => sum + Number(b.totalCharges),
      0,
    );
    const totalPayments = payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const totalAdjustments = billings.reduce(
      (sum, b) => sum + Number(b.totalAdjustments),
      0,
    );
    const totalRefunds = payments
      .filter((p) => p.amount < 0)
      .reduce((sum, p) => sum + Math.abs(Number(p.amount)), 0);

    const outstandingAR = billings.reduce((sum, b) => sum + Number(b.balance), 0);

    const claimsSubmitted = claims.filter(
      (c) => c.status !== ClaimStatus.DRAFT,
    ).length;
    const claimsPaid = claims.filter((c) => c.status === ClaimStatus.PAID).length;
    const claimsDenied = claims.filter(
      (c) => c.status === ClaimStatus.DENIED,
    ).length;
    const claimsPending = claims.filter(
      (c) =>
        c.status === ClaimStatus.PENDING ||
        c.status === ClaimStatus.SUBMITTED ||
        c.status === ClaimStatus.ACCEPTED,
    ).length;

    const cleanClaimRate =
      claimsSubmitted > 0
        ? ((claimsSubmitted - claims.filter((c) => c.submissionAttempts > 1).length) /
            claimsSubmitted) *
          100
        : 0;

    const denialRate = claimsSubmitted > 0 ? (claimsDenied / claimsSubmitted) * 100 : 0;
    const collectionRate = totalCharges > 0 ? (totalPayments / totalCharges) * 100 : 0;

    const paidClaims = claims.filter((c) => c.adjudicatedAt);
    const totalDaysToPayment = paidClaims.reduce((sum, c) => {
      const days = Math.floor(
        (c.adjudicatedAt!.getTime() - c.submittedAt!.getTime()) /
          (1000 * 60 * 60 * 24),
      );
      return sum + days;
    }, 0);
    const averageDaysToPayment =
      paidClaims.length > 0 ? totalDaysToPayment / paidClaims.length : 0;

    const arAging = await this.calculateARAgingForPeriod(endDate);

    const payerMix = this.calculatePayerMix(claims, payments);
    const topDenialReasons = this.calculateTopDenialReasons(denials);
    const topProcedures = this.calculateTopProcedures(billings);
    const providerPerformance = this.calculateProviderPerformance(billings);
    const monthlyTrend = await this.calculateMonthlyTrend(startDate, endDate);

    const report = this.reportRepository.create({
      reportType: generateDto.reportType,
      periodType: generateDto.periodType,
      periodStart: startDate,
      periodEnd: endDate,
      generatedAt: new Date(),
      totalCharges,
      totalPayments,
      totalAdjustments,
      totalRefunds,
      netRevenue: totalPayments - totalRefunds,
      outstandingAR,
      arAging,
      claimsSubmitted,
      claimsPaid,
      claimsDenied,
      claimsPending,
      cleanClaimRate,
      denialRate,
      collectionRate,
      averageDaysToPayment,
      averageDaysInAR: 0,
      payerMix,
      topDenialReasons,
      topProcedures,
      providerPerformance,
      monthlyTrend,
      keyMetrics: {
        grossCollectionRate: collectionRate,
        netCollectionRate:
          totalCharges - totalAdjustments > 0
            ? (totalPayments / (totalCharges - totalAdjustments)) * 100
            : 0,
        adjustmentRate:
          totalCharges > 0 ? (totalAdjustments / totalCharges) * 100 : 0,
        badDebtRate: 0,
        costToCollect: 0,
      },
      notes: generateDto.notes,
    });

    return this.reportRepository.save(report);
  }

  private async calculateARAgingForPeriod(
    asOfDate: Date,
  ): Promise<{
    current: number;
    days30: number;
    days60: number;
    days90: number;
    days120Plus: number;
  }> {
    const day30 = new Date(asOfDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    const day60 = new Date(asOfDate.getTime() - 60 * 24 * 60 * 60 * 1000);
    const day90 = new Date(asOfDate.getTime() - 90 * 24 * 60 * 60 * 1000);
    const day120 = new Date(asOfDate.getTime() - 120 * 24 * 60 * 60 * 1000);

    const allBillings = await this.billingRepository.find({
      where: { balance: MoreThanOrEqual(0.01) },
    });

    let current = 0;
    let days30 = 0;
    let days60 = 0;
    let days90 = 0;
    let days120Plus = 0;

    for (const billing of allBillings) {
      const serviceDate = new Date(billing.serviceDate);

      if (serviceDate >= day30) {
        current += Number(billing.balance);
      } else if (serviceDate >= day60) {
        days30 += Number(billing.balance);
      } else if (serviceDate >= day90) {
        days60 += Number(billing.balance);
      } else if (serviceDate >= day120) {
        days90 += Number(billing.balance);
      } else {
        days120Plus += Number(billing.balance);
      }
    }

    return { current, days30, days60, days90, days120Plus };
  }

  private calculatePayerMix(
    claims: InsuranceClaim[],
    payments: Payment[],
  ): Array<{
    payerName: string;
    payerType: string;
    charges: number;
    payments: number;
    claimCount: number;
    percentageOfRevenue: number;
  }> {
    const payerMap: Record<
      string,
      {
        payerName: string;
        payerType: string;
        charges: number;
        payments: number;
        claimCount: number;
      }
    > = {};

    for (const claim of claims) {
      const payerName = claim.insurance?.payerName || 'Unknown';
      const payerType = claim.insurance?.payerType || 'unknown';

      if (!payerMap[payerName]) {
        payerMap[payerName] = {
          payerName,
          payerType,
          charges: 0,
          payments: 0,
          claimCount: 0,
        };
      }

      payerMap[payerName].charges += Number(claim.billedAmount);
      payerMap[payerName].payments += Number(claim.paidAmount);
      payerMap[payerName].claimCount += 1;
    }

    const totalRevenue = Object.values(payerMap).reduce(
      (sum, p) => sum + p.payments,
      0,
    );

    return Object.values(payerMap)
      .map((payer) => ({
        ...payer,
        percentageOfRevenue:
          totalRevenue > 0 ? (payer.payments / totalRevenue) * 100 : 0,
      }))
      .sort((a, b) => b.payments - a.payments);
  }

  private calculateTopDenialReasons(
    denials: ClaimDenial[],
  ): Array<{
    reason: string;
    count: number;
    amount: number;
    percentage: number;
  }> {
    const reasonMap: Record<string, { count: number; amount: number }> = {};

    for (const denial of denials) {
      const reason = denial.primaryReason;
      if (!reasonMap[reason]) {
        reasonMap[reason] = { count: 0, amount: 0 };
      }
      reasonMap[reason].count += 1;
      reasonMap[reason].amount += Number(denial.deniedAmount);
    }

    const totalDenials = denials.length;

    return Object.entries(reasonMap)
      .map(([reason, data]) => ({
        reason,
        count: data.count,
        amount: data.amount,
        percentage: totalDenials > 0 ? (data.count / totalDenials) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  private calculateTopProcedures(
    billings: Billing[],
  ): Array<{
    cptCode: string;
    description: string;
    count: number;
    charges: number;
    collections: number;
  }> {
    const procedureMap: Record<
      string,
      { description: string; count: number; charges: number; collections: number }
    > = {};

    for (const billing of billings) {
      for (const lineItem of billing.lineItems || []) {
        const code = lineItem.cptCode;
        if (!procedureMap[code]) {
          procedureMap[code] = {
            description: lineItem.cptDescription,
            count: 0,
            charges: 0,
            collections: 0,
          };
        }
        procedureMap[code].count += 1;
        procedureMap[code].charges += Number(lineItem.totalCharge);
        procedureMap[code].collections += Number(lineItem.paidAmount || 0);
      }
    }

    return Object.entries(procedureMap)
      .map(([cptCode, data]) => ({
        cptCode,
        ...data,
      }))
      .sort((a, b) => b.charges - a.charges)
      .slice(0, 20);
  }

  private calculateProviderPerformance(
    billings: Billing[],
  ): Array<{
    providerId: string;
    providerName: string;
    charges: number;
    collections: number;
    encounters: number;
    avgRevenuePerEncounter: number;
  }> {
    const providerMap: Record<
      string,
      {
        providerName: string;
        charges: number;
        collections: number;
        encounters: number;
      }
    > = {};

    for (const billing of billings) {
      const providerId = billing.providerId;
      if (!providerMap[providerId]) {
        providerMap[providerId] = {
          providerName: billing.providerName,
          charges: 0,
          collections: 0,
          encounters: 0,
        };
      }
      providerMap[providerId].charges += Number(billing.totalCharges);
      providerMap[providerId].collections += Number(billing.totalPayments);
      providerMap[providerId].encounters += 1;
    }

    return Object.entries(providerMap)
      .map(([providerId, data]) => ({
        providerId,
        ...data,
        avgRevenuePerEncounter:
          data.encounters > 0 ? data.collections / data.encounters : 0,
      }))
      .sort((a, b) => b.collections - a.collections);
  }

  private async calculateMonthlyTrend(
    startDate: Date,
    endDate: Date,
  ): Promise<Array<{
    month: string;
    charges: number;
    payments: number;
    adjustments: number;
  }>> {
    const trend: Array<{
      month: string;
      charges: number;
      payments: number;
      adjustments: number;
    }> = [];

    const current = new Date(startDate);
    current.setDate(1);

    while (current <= endDate) {
      const monthStart = new Date(current);
      const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0);

      const billings = await this.billingRepository.find({
        where: { serviceDate: Between(monthStart, monthEnd) },
      });

      const payments = await this.paymentRepository.find({
        where: {
          paymentDate: Between(monthStart, monthEnd),
          status: PaymentStatus.COMPLETED,
        },
      });

      trend.push({
        month: `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`,
        charges: billings.reduce((sum, b) => sum + Number(b.totalCharges), 0),
        payments: payments.reduce((sum, p) => sum + Number(p.amount), 0),
        adjustments: billings.reduce(
          (sum, b) => sum + Number(b.totalAdjustments),
          0,
        ),
      });

      current.setMonth(current.getMonth() + 1);
    }

    return trend;
  }

  async getARAgingReport(arAgingDto: ARAgingReportDto): Promise<{
    summary: {
      current: number;
      days30: number;
      days60: number;
      days90: number;
      days120Plus: number;
      total: number;
    };
    details: Array<{
      billingId: string;
      patientId: string;
      invoiceNumber: string;
      serviceDate: Date;
      balance: number;
      agingBucket: string;
    }>;
  }> {
    const asOfDate = new Date(arAgingDto.asOfDate);
    const day30 = new Date(asOfDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    const day60 = new Date(asOfDate.getTime() - 60 * 24 * 60 * 60 * 1000);
    const day90 = new Date(asOfDate.getTime() - 90 * 24 * 60 * 60 * 1000);
    const day120 = new Date(asOfDate.getTime() - 120 * 24 * 60 * 60 * 1000);

    const allBillings = await this.billingRepository.find({
      where: { balance: MoreThanOrEqual(0.01) },
    });

    const summary = { current: 0, days30: 0, days60: 0, days90: 0, days120Plus: 0, total: 0 };
    const details: Array<{
      billingId: string;
      patientId: string;
      invoiceNumber: string;
      serviceDate: Date;
      balance: number;
      agingBucket: string;
    }> = [];

    for (const billing of allBillings) {
      const serviceDate = new Date(billing.serviceDate);
      let agingBucket: string;

      if (serviceDate >= day30) {
        summary.current += Number(billing.balance);
        agingBucket = 'current';
      } else if (serviceDate >= day60) {
        summary.days30 += Number(billing.balance);
        agingBucket = '31-60';
      } else if (serviceDate >= day90) {
        summary.days60 += Number(billing.balance);
        agingBucket = '61-90';
      } else if (serviceDate >= day120) {
        summary.days90 += Number(billing.balance);
        agingBucket = '91-120';
      } else {
        summary.days120Plus += Number(billing.balance);
        agingBucket = '120+';
      }

      details.push({
        billingId: billing.id,
        patientId: billing.patientId,
        invoiceNumber: billing.invoiceNumber,
        serviceDate: billing.serviceDate,
        balance: Number(billing.balance),
        agingBucket,
      });
    }

    summary.total =
      summary.current +
      summary.days30 +
      summary.days60 +
      summary.days90 +
      summary.days120Plus;

    return { summary, details };
  }

  async getDenialAnalysisReport(analysisDto: DenialAnalysisDto): Promise<{
    summary: {
      totalDenials: number;
      totalDeniedAmount: number;
      appealedCount: number;
      overturnedCount: number;
      recoveredAmount: number;
    };
    byReason: Array<{ reason: string; count: number; amount: number; percentage: number }>;
    byPayer: Array<{ payerName: string; count: number; amount: number }>;
    trend: Array<{ month: string; count: number; amount: number }>;
  }> {
    const startDate = new Date(analysisDto.startDate);
    const endDate = new Date(analysisDto.endDate);

    const denials = await this.denialRepository.find({
      where: { denialDate: Between(startDate, endDate) },
      relations: ['claim', 'claim.insurance', 'appeals'],
    });

    const summary = {
      totalDenials: denials.length,
      totalDeniedAmount: denials.reduce((sum, d) => sum + Number(d.deniedAmount), 0),
      appealedCount: denials.filter((d) => d.appeals && d.appeals.length > 0).length,
      overturnedCount: denials.filter((d) => d.isResolved && d.resolutionType === 'appeal_approved').length,
      recoveredAmount: denials
        .filter((d) => d.isResolved)
        .reduce((sum, d) => sum + Number(d.recoveredAmount || 0), 0),
    };

    const byReasonMap: Record<string, { count: number; amount: number }> = {};
    const byPayerMap: Record<string, { count: number; amount: number }> = {};
    const trendMap: Record<string, { count: number; amount: number }> = {};

    for (const denial of denials) {
      const reason = denial.primaryReason;
      if (!byReasonMap[reason]) {
        byReasonMap[reason] = { count: 0, amount: 0 };
      }
      byReasonMap[reason].count += 1;
      byReasonMap[reason].amount += Number(denial.deniedAmount);

      const payerName = denial.claim?.insurance?.payerName || 'Unknown';
      if (!byPayerMap[payerName]) {
        byPayerMap[payerName] = { count: 0, amount: 0 };
      }
      byPayerMap[payerName].count += 1;
      byPayerMap[payerName].amount += Number(denial.deniedAmount);

      const month = `${denial.denialDate.getFullYear()}-${String(denial.denialDate.getMonth() + 1).padStart(2, '0')}`;
      if (!trendMap[month]) {
        trendMap[month] = { count: 0, amount: 0 };
      }
      trendMap[month].count += 1;
      trendMap[month].amount += Number(denial.deniedAmount);
    }

    return {
      summary,
      byReason: Object.entries(byReasonMap)
        .map(([reason, data]) => ({
          reason,
          ...data,
          percentage: summary.totalDenials > 0 ? (data.count / summary.totalDenials) * 100 : 0,
        }))
        .sort((a, b) => b.count - a.count),
      byPayer: Object.entries(byPayerMap)
        .map(([payerName, data]) => ({ payerName, ...data }))
        .sort((a, b) => b.count - a.count),
      trend: Object.entries(trendMap)
        .map(([month, data]) => ({ month, ...data }))
        .sort((a, b) => a.month.localeCompare(b.month)),
    };
  }

  async getReportHistory(searchDto: {
    reportType?: ReportType;
    periodType?: PeriodType;
    startDate?: string;
    endDate?: string;
  }): Promise<RevenueReport[]> {
    const where: any = {};

    if (searchDto.reportType) {
      where.reportType = searchDto.reportType;
    }

    if (searchDto.periodType) {
      where.periodType = searchDto.periodType;
    }

    if (searchDto.startDate && searchDto.endDate) {
      where.generatedAt = Between(
        new Date(searchDto.startDate),
        new Date(searchDto.endDate),
      );
    }

    return this.reportRepository.find({
      where,
      order: { generatedAt: 'DESC' },
      take: 50,
    });
  }
}
