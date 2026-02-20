import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MedicalCodeRegistry } from '../entities/medical-validation.entities';
import { CodeValidationResult } from '../interfaces/validation-result.interface';
import { CPT_CATEGORIES, CPT_PATTERN } from '../medical-codes.constants';

@Injectable()
export class CptValidationService {
  private readonly logger = new Logger(CptValidationService.name);

  constructor(
    @InjectRepository(MedicalCodeRegistry)
    private readonly codeRegistryRepo: Repository<MedicalCodeRegistry>,
  ) {}

  async validate(code: string, associatedDiagnosisCodes?: string[]): Promise<CodeValidationResult> {
    const result: CodeValidationResult = {
      code,
      codeSystem: 'CPT',
      isValid: false,
      isActive: false,
      warnings: [],
      errors: [],
    };

    // 1. Format validation
    if (!CPT_PATTERN.test(code)) {
      result.errors.push(
        `Invalid CPT format. Expected 5-digit code or 4 digits + alphanumeric. Got: "${code}"`,
      );
      return result;
    }

    const numericCode = parseInt(code, 10);

    // 2. Category determination
    result.category = this.determineCptCategory(numericCode, code);

    // 3. Special code type checks
    this.checkSpecialCptCodes(code, result);

    // 4. Database lookup
    try {
      const dbRecord = await this.codeRegistryRepo.findOne({
        where: { codeSystem: 'CPT', code },
      });

      if (dbRecord) {
        result.isValid = true;
        result.isActive = dbRecord.isActive;
        result.description = dbRecord.description;
        result.metadata = dbRecord.metadata;

        if (!dbRecord.isActive) {
          result.errors.push(
            `CPT code "${code}" is deleted/retired. Do not use for billing after its retirement date.`,
          );
        }
      } else {
        result.isValid = true;
        result.isActive = true;
        result.warnings.push(
          `CPT code "${code}" not found in local registry. Verify against current AMA CPT manual.`,
        );
      }
    } catch (error) {
      this.logger.error(`Database lookup failed for CPT code ${code}`, error);
      result.warnings.push('Registry lookup unavailable; format validation only applied.');
      result.isValid = true;
    }

    // 5. Diagnosis code compatibility
    if (associatedDiagnosisCodes?.length) {
      const compatibilityWarnings = await this.checkDiagnosisCompatibility(
        code,
        associatedDiagnosisCodes,
      );
      result.warnings.push(...compatibilityWarnings);
    }

    return result;
  }

  async validateModifier(cptCode: string, modifier: string): Promise<{
    isValid: boolean;
    warnings: string[];
  }> {
    const validModifiers = [
      '25', '26', '59', '91', 'TC', 'GT', '95', '99', 'GA', 'GX',
      '50', '51', '52', '53', '54', '55', '56', '57', '58',
    ];

    const warnings: string[] = [];
    const isValid = validModifiers.includes(modifier.toUpperCase());

    if (!isValid) {
      warnings.push(`Modifier "${modifier}" is not in the common modifier list. Verify validity.`);
    }

    // Modifier 25 - significant separately identifiable E/M service
    if (modifier === '25') {
      const numericCode = parseInt(cptCode, 10);
      if (numericCode < 99202 || numericCode > 99499) {
        warnings.push(
          `Modifier 25 is typically applied to E/M codes (99202-99499), not to "${cptCode}".`,
        );
      }
    }

    return { isValid, warnings };
  }

  private determineCptCategory(numericCode: number, code: string): string {
    if (isNaN(numericCode)) return 'Category III (Emerging Technology)';

    for (const [category, { range, description }] of Object.entries(CPT_CATEGORIES)) {
      if (numericCode >= range[0] && numericCode <= range[1]) {
        return description;
      }
    }

    return 'Unknown Category';
  }

  private checkSpecialCptCodes(code: string, result: CodeValidationResult): void {
    // Category II codes end in F
    if (code.endsWith('F')) {
      result.warnings.push(
        `CPT code "${code}" appears to be a Category II (performance measurement) code. These are supplemental and not used for reimbursement.`,
      );
    }

    // Category III codes - 4 digits + T
    if (code.endsWith('T')) {
      result.warnings.push(
        `CPT code "${code}" appears to be a Category III (emerging technology) code. Reimbursement may be limited.`,
      );
    }

    // Unlisted procedure codes typically end in 99
    if (code.endsWith('99')) {
      result.warnings.push(
        `CPT code "${code}" appears to be an unlisted procedure code. Documentation and manual review required.`,
      );
    }
  }

  private async checkDiagnosisCompatibility(
    cptCode: string,
    icd10Codes: string[],
  ): Promise<string[]> {
    const warnings: string[] = [];

    // Example: preventive care codes (99381-99397) typically use Z-codes
    const numericCpt = parseInt(cptCode, 10);
    if (numericCpt >= 99381 && numericCpt <= 99397) {
      const hasZCode = icd10Codes.some((c) => c.startsWith('Z'));
      if (!hasZCode) {
        warnings.push(
          `Preventive visit code "${cptCode}" typically requires a Z-category ICD-10 diagnosis code.`,
        );
      }
    }

    return warnings;
  }
}
