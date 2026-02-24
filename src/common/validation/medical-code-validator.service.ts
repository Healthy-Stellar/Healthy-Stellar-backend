import { Injectable } from '@nestjs/common';

@Injectable()
export class MedicalCodeValidatorService {
  private icd10Codes: Map<string, string>;
  private cptCodes: Map<string, string>;

  constructor() {
    this.initializeCodeDatabases();
  }

  private initializeCodeDatabases(): void {
    this.icd10Codes = new Map([
      ['A00', 'Cholera'],
      ['A01', 'Typhoid fever'],
      ['A02', 'Salmonella infection'],
      ['E10', 'Type 1 diabetes mellitus'],
      ['E11', 'Type 2 diabetes mellitus'],
      ['I10', 'Essential hypertension'],
      ['I21', 'Myocardial infarction'],
      ['I63', 'Cerebral infarction'],
      ['R06', 'Abnormalities of breathing'],
      ['R50', 'Fever of other and unknown origin'],
    ]);

    this.cptCodes = new Map([
      ['99213', 'Office visit - established patient, low complexity'],
      ['99214', 'Office visit - established patient, moderate complexity'],
      ['99215', 'Office visit - established patient, high complexity'],
      ['70450', 'CT head/brain without contrast'],
      ['71046', 'Chest X-ray 2 views'],
      ['80053', 'Comprehensive metabolic panel'],
      ['85025', 'Complete blood count'],
    ]);
  }

  validateICD10Code(code: string): { valid: boolean; description?: string } {
    const normalized = code.trim().toUpperCase();

    if (this.icd10Codes.has(normalized)) {
      return {
        valid: true,
        description: this.icd10Codes.get(normalized),
      };
    }

    const icd10Pattern = /^[A-Z][0-9][A-Z0-9](\.[A-Z0-9]{1,2})?$/;
    return {
      valid: icd10Pattern.test(normalized),
    };
  }

  validateCPTCode(code: string): { valid: boolean; description?: string } {
    const normalized = code.trim();

    if (this.cptCodes.has(normalized)) {
      return {
        valid: true,
        description: this.cptCodes.get(normalized),
      };
    }

    const cptPattern = /^[0-9]{5}$/;
    return {
      valid: cptPattern.test(normalized),
    };
  }

  validateNDCCode(code: string): boolean {
    const ndcPattern = /^[0-9]{5}-[0-9]{3,4}-[0-9]{1,2}$/;
    return ndcPattern.test(code.trim());
  }
}
