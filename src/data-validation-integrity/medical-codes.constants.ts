/**
 * Medical coding constants for ICD-10, CPT, and LOINC validation
 * In production, these would be loaded from a database or external service
 */

export const ICD10_PATTERN = /^[A-Z][0-9]{2}(\.[0-9A-Z]{1,4})?$/;
export const CPT_PATTERN = /^[0-9]{4}[0-9A-Z]$|^[0-9]{5}$/;
export const LOINC_PATTERN = /^[0-9]{1,5}-[0-9]$/;
export const NDC_PATTERN = /^[0-9]{10,11}$/;
export const SNOMED_PATTERN = /^[0-9]{6,18}$/;

/**
 * ICD-10 chapter prefixes for category validation
 */
export const ICD10_CHAPTERS: Record<string, string> = {
  A: 'Certain infectious and parasitic diseases',
  B: 'Certain infectious and parasitic diseases',
  C: 'Neoplasms',
  D: 'Diseases of the blood / Neoplasms',
  E: 'Endocrine, nutritional and metabolic diseases',
  F: 'Mental, Behavioral and Neurodevelopmental disorders',
  G: 'Diseases of the nervous system',
  H: 'Diseases of the eye / ear',
  I: 'Diseases of the circulatory system',
  J: 'Diseases of the respiratory system',
  K: 'Diseases of the digestive system',
  L: 'Diseases of the skin',
  M: 'Diseases of the musculoskeletal system',
  N: 'Diseases of the genitourinary system',
  O: 'Pregnancy, childbirth and puerperium',
  P: 'Certain conditions originating in the perinatal period',
  Q: 'Congenital malformations',
  R: 'Symptoms, signs and abnormal clinical findings',
  S: 'Injury, poisoning and external causes',
  T: 'Injury, poisoning and external causes',
  V: 'External causes of morbidity',
  W: 'External causes of morbidity',
  X: 'External causes of morbidity',
  Y: 'External causes of morbidity',
  Z: 'Factors influencing health status',
};

/**
 * CPT code ranges by category
 */
export const CPT_CATEGORIES: Record<string, { range: [number, number]; description: string }> = {
  EVALUATION_MANAGEMENT: { range: [99202, 99499], description: 'Evaluation and Management' },
  ANESTHESIA: { range: [100, 1999], description: 'Anesthesia' },
  SURGERY: { range: [10004, 69990], description: 'Surgery' },
  RADIOLOGY: { range: [70010, 79999], description: 'Radiology' },
  PATHOLOGY: { range: [80047, 89398], description: 'Pathology and Laboratory' },
  MEDICINE: { range: [90281, 99199], description: 'Medicine' },
};

/**
 * LOINC component types for lab result validation
 */
export const LOINC_SCALE_TYPES = ['Qn', 'Ord', 'OrdQn', 'Nom', 'Nar', 'Multi', 'Doc', 'Set'] as const;
export type LoincScaleType = (typeof LOINC_SCALE_TYPES)[number];

/**
 * Clinical alert severity levels
 */
export enum AlertSeverity {
  INFO = 'INFO',
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

/**
 * Data quality dimensions
 */
export enum DataQualityDimension {
  COMPLETENESS = 'COMPLETENESS',
  ACCURACY = 'ACCURACY',
  CONSISTENCY = 'CONSISTENCY',
  TIMELINESS = 'TIMELINESS',
  VALIDITY = 'VALIDITY',
  UNIQUENESS = 'UNIQUENESS',
}

/**
 * Healthcare data governance policy types
 */
export enum GovernancePolicyType {
  DATA_RETENTION = 'DATA_RETENTION',
  ACCESS_CONTROL = 'ACCESS_CONTROL',
  DATA_QUALITY = 'DATA_QUALITY',
  AUDIT_REQUIREMENT = 'AUDIT_REQUIREMENT',
  CONSENT_MANAGEMENT = 'CONSENT_MANAGEMENT',
  PHI_PROTECTION = 'PHI_PROTECTION',
}
