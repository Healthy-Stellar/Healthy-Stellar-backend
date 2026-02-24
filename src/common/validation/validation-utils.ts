import { MEDICAL_CODE_PATTERNS } from './medical-validation.constants';

export class ValidationUtils {
  static isValidICD10(code: string): boolean {
    return MEDICAL_CODE_PATTERNS.ICD10.test(code.trim().toUpperCase());
  }

  static isValidCPT(code: string): boolean {
    return MEDICAL_CODE_PATTERNS.CPT.test(code.trim());
  }

  static isValidMRN(mrn: string): boolean {
    return MEDICAL_CODE_PATTERNS.MRN.test(mrn.trim().toUpperCase());
  }

  static formatICD10(code: string): string {
    return code.trim().toUpperCase();
  }

  static formatCPT(code: string): string {
    return code.trim();
  }

  static extractCodesFromText(text: string): {
    icd10Codes: string[];
    cptCodes: string[];
  } {
    const icd10Regex = /[A-Z][0-9][A-Z0-9](\.[A-Z0-9]{1,2})?/g;
    const cptRegex = /\b\d{5}\b/g;

    const icd10Codes = text.match(icd10Regex) || [];
    const cptCodes = text.match(cptRegex) || [];

    return {
      icd10Codes: [...new Set(icd10Codes)],
      cptCodes: [...new Set(cptCodes)],
    };
  }

  static validatePasswordStrength(password: string): {
    isStrong: boolean;
    feedback: string[];
  } {
    const feedback: string[] = [];
    let isStrong = true;

    if (password.length < 12) {
      feedback.push('Password must be at least 12 characters long');
      isStrong = false;
    }

    if (!/[A-Z]/.test(password)) {
      feedback.push('Password must contain at least one uppercase letter');
      isStrong = false;
    }

    if (!/[a-z]/.test(password)) {
      feedback.push('Password must contain at least one lowercase letter');
      isStrong = false;
    }

    if (!/[0-9]/.test(password)) {
      feedback.push('Password must contain at least one number');
      isStrong = false;
    }

    if (!/[!@#$%^&*]/.test(password)) {
      feedback.push('Password must contain at least one special character (!@#$%^&*)');
      isStrong = false;
    }

    return { isStrong, feedback };
  }
}
