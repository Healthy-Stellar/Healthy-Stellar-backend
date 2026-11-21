/**
 * PHI Field Registry — documents which PHI fields may use deterministic
 * (searchable) encryption versus randomised encryption.
 *
 * Deterministic mode (AES-256-GCM with HMAC-derived IV, equivalent to
 * AES-SIV in its searchability guarantee) enables exact-match index lookups
 * (e.g. SELECT * WHERE encrypted_ssn = $1) without decrypting every row.
 *
 * SECURITY RULES
 * ──────────────
 * Use deterministic mode ONLY for:
 *  • High-cardinality coded identifiers (SSN, MRN, passport number)
 *    where brute-force enumeration is not feasible.
 *
 * NEVER use deterministic mode for:
 *  • Low-cardinality fields (gender, blood type, boolean flags) —
 *    identical ciphertexts leak the distribution and allow inference attacks.
 *  • Free-text clinical notes or descriptions — randomised mode required.
 */

export type EncryptionMode = 'deterministic' | 'randomised';

export interface PhiFieldConfig {
  mode: EncryptionMode;
  description: string;
}

export const PHI_FIELD_REGISTRY: Record<string, PhiFieldConfig> = {
  // ── High-cardinality identifiers: deterministic mode allowed ────────────
  nationalId: {
    mode: 'deterministic',
    description: 'National/government-issued identifier — high cardinality, safe for exact-match lookup',
  },
  mrn: {
    mode: 'deterministic',
    description: 'Medical Record Number — facility-assigned, high cardinality',
  },
  passportNumber: {
    mode: 'deterministic',
    description: 'Passport number — high cardinality government identifier',
  },
  insuranceId: {
    mode: 'deterministic',
    description: 'Insurance member/policy number — high cardinality',
  },
  email: {
    mode: 'deterministic',
    description: 'Patient contact email — high cardinality, used for deduplication lookups',
  },

  // ── Low-cardinality or free-text: randomised mode required ──────────────
  sex: {
    mode: 'randomised',
    description: 'Sex/gender — low cardinality (≤10 values), deterministic mode would leak distribution',
  },
  bloodType: {
    mode: 'randomised',
    description: 'Blood type — low cardinality (8 ABO+Rh values), inference attack risk',
  },
  clinicalNotes: {
    mode: 'randomised',
    description: 'Free-text clinical notes — arbitrary length, randomised mode required',
  },
  prescriptionDetails: {
    mode: 'randomised',
    description: 'Free-text prescription details — randomised mode required',
  },
  address: {
    mode: 'randomised',
    description: 'Full address — free text, randomised mode required',
  },
};

export function getFieldMode(fieldName: string): EncryptionMode {
  return PHI_FIELD_REGISTRY[fieldName]?.mode ?? 'randomised';
}

export function isDeterministicEligible(fieldName: string): boolean {
  return getFieldMode(fieldName) === 'deterministic';
}
