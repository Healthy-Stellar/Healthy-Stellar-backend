export class InsuranceProviderDto {
  id: string;
  name: string;
  providerCode: string;
  contactPerson: string;
  phoneNumber: string;
  email: string;
  address: string;
  payerType: "government" | "private" | "corporate";
  acceptedPlans: InsurancePlanDto[];
  claimSubmissionMethod: "electronic" | "paper" | "both";
  averageProcessingDays: number;
  isActive: boolean;
}

export class InsurancePlanDto {
  planId: string;
  planName: string;
  planType: "HMO" | "PPO" | "EPO" | "POS";
  coveragePercentage: number;
  deductible: number;
  copayAmount: number;
  maxCoverage: number;
  coveredServices: string[];
  excludedServices: string[];
}

export class BillingConfigDto {
  id: string;
  hospitalId: string;
  taxRate: number;
  currency: string;
  paymentMethods: ("cash" | "card" | "insurance" | "check" | "online")[];
  invoicePrefix: string;
  invoiceNumberSequence: number;
  billingCycle: "daily" | "weekly" | "monthly";
  lateFeePercentage: number;
  gracePeriodDays: number;
  acceptedInsuranceProviders: string[];
}
