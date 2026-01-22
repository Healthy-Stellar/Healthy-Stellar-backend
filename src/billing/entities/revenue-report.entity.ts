import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('revenue_reports')
export class RevenueReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  @Index()
  reportType: string;

  @Column({ type: 'varchar', length: 20 })
  @Index()
  periodType: string;

  @Column({ type: 'date' })
  @Index()
  periodStart: Date;

  @Column({ type: 'date' })
  periodEnd: Date;

  @Column({ type: 'datetime' })
  generatedAt: Date;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  totalCharges: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  totalPayments: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  totalAdjustments: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  totalRefunds: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  netRevenue: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  outstandingAR: number;

  @Column({ type: 'simple-json', nullable: true })
  arAging: {
    current: number;
    days30: number;
    days60: number;
    days90: number;
    days120Plus: number;
  };

  @Column({ type: 'integer', default: 0 })
  claimsSubmitted: number;

  @Column({ type: 'integer', default: 0 })
  claimsPaid: number;

  @Column({ type: 'integer', default: 0 })
  claimsDenied: number;

  @Column({ type: 'integer', default: 0 })
  claimsPending: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  cleanClaimRate: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  denialRate: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  collectionRate: number;

  @Column({ type: 'decimal', precision: 8, scale: 2, default: 0 })
  averageDaysToPayment: number;

  @Column({ type: 'decimal', precision: 8, scale: 2, default: 0 })
  averageDaysInAR: number;

  @Column({ type: 'simple-json', nullable: true })
  payerMix: Array<{
    payerName: string;
    payerType: string;
    charges: number;
    payments: number;
    claimCount: number;
    percentageOfRevenue: number;
  }>;

  @Column({ type: 'simple-json', nullable: true })
  topDenialReasons: Array<{
    reason: string;
    count: number;
    amount: number;
    percentage: number;
  }>;

  @Column({ type: 'simple-json', nullable: true })
  topProcedures: Array<{
    cptCode: string;
    description: string;
    count: number;
    charges: number;
    collections: number;
  }>;

  @Column({ type: 'simple-json', nullable: true })
  providerPerformance: Array<{
    providerId: string;
    providerName: string;
    charges: number;
    collections: number;
    encounters: number;
    avgRevenuePerEncounter: number;
  }>;

  @Column({ type: 'simple-json', nullable: true })
  monthlyTrend: Array<{
    month: string;
    charges: number;
    payments: number;
    adjustments: number;
  }>;

  @Column({ type: 'simple-json', nullable: true })
  keyMetrics: {
    grossCollectionRate: number;
    netCollectionRate: number;
    adjustmentRate: number;
    badDebtRate: number;
    costToCollect: number;
  };

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  generatedBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
