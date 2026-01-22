export enum ClaimStatus {
  DRAFT = 'draft',
  PENDING = 'pending',
  SUBMITTED = 'submitted',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  PAID = 'paid',
  PARTIALLY_PAID = 'partially_paid',
  DENIED = 'denied',
  APPEALED = 'appealed',
  VOID = 'void',
}

export enum ClaimType {
  PROFESSIONAL = '837P',
  INSTITUTIONAL = '837I',
  DENTAL = '837D',
}

export enum InsuranceType {
  PRIMARY = 'primary',
  SECONDARY = 'secondary',
  TERTIARY = 'tertiary',
}

export enum PayerType {
  COMMERCIAL = 'commercial',
  MEDICARE = 'medicare',
  MEDICAID = 'medicaid',
  TRICARE = 'tricare',
  WORKERS_COMP = 'workers_comp',
  AUTO = 'auto',
  SELF_PAY = 'self_pay',
}

export enum VerificationStatus {
  PENDING = 'pending',
  VERIFIED = 'verified',
  FAILED = 'failed',
  EXPIRED = 'expired',
}

export enum AuthorizationStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  DENIED = 'denied',
  EXPIRED = 'expired',
  NOT_REQUIRED = 'not_required',
}

export enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
  PARTIALLY_REFUNDED = 'partially_refunded',
}

export enum PaymentMethod {
  INSURANCE = 'insurance',
  CREDIT_CARD = 'credit_card',
  DEBIT_CARD = 'debit_card',
  ACH = 'ach',
  CHECK = 'check',
  CASH = 'cash',
  PATIENT_PORTAL = 'patient_portal',
}

export enum DenialReason {
  COVERAGE_TERMINATED = 'coverage_terminated',
  NOT_MEDICALLY_NECESSARY = 'not_medically_necessary',
  DUPLICATE_CLAIM = 'duplicate_claim',
  INVALID_CODES = 'invalid_codes',
  MISSING_INFORMATION = 'missing_information',
  OUT_OF_NETWORK = 'out_of_network',
  PRE_AUTH_REQUIRED = 'pre_auth_required',
  TIMELY_FILING = 'timely_filing',
  COORDINATION_OF_BENEFITS = 'coordination_of_benefits',
  OTHER = 'other',
}

export enum AppealStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  UNDER_REVIEW = 'under_review',
  APPROVED = 'approved',
  DENIED = 'denied',
  WITHDRAWN = 'withdrawn',
}

export enum CodeType {
  CPT = 'CPT',
  ICD10_CM = 'ICD10-CM',
  ICD10_PCS = 'ICD10-PCS',
  HCPCS = 'HCPCS',
}
