export const MEDICAL_CODE_PATTERNS = {
  ICD10: /^[A-Z][0-9][A-Z0-9](\.[A-Z0-9]{1,2})?$/,
  CPT: /^[0-9]{5}$/,
  HCPCS: /^[A-Z][0-9]{4}$/,
  NDC: /^[0-9]{5}-[0-9]{3,4}-[0-9]{1,2}$/,
  MRN: /^[A-Z0-9\-]{6,20}$/,
};

export const VALIDATION_RULES = {
  CLINICAL_NOTE_MAX_LENGTH: 5000,
  DIAGNOSIS_CODE_MAX_LENGTH: 500,
  PHONE_NUMBER_PATTERN: /^(\+1)?[\s\-]?[(]?[0-9]{3}[)]?[\s\-]?[0-9]{3}[\s\-]?[0-9]{4}$/,
  EMAIL_PATTERN: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  SSN_PATTERN: /^[0-9]{3}-[0-9]{2}-[0-9]{4}$/,
};

export const EMERGENCY_ALERT_KEYWORDS = [
  'CRITICAL',
  'EMERGENCY',
  'SEVERE',
  'UNSTABLE',
  'ANAPHYLAXIS',
  'MYOCARDIAL_INFARCTION',
  'STROKE',
  'SEPSIS',
];

export const PHI_FIELDS = [
  'ssn',
  'dateOfBirth',
  'address',
  'phoneNumber',
  'email',
  'medicalRecordNumber',
  'accountNumber',
];

export const AUDIT_LOG_RETENTION_DAYS = 2555; // 7 years per HIPAA
