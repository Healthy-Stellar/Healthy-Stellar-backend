import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MedicalCodeRegistry } from '../entities/medical-validation.entities';
import { CodeValidationResult } from '../interfaces/validation-result.interface';
import { LOINC_PATTERN } from '../medical-codes.constants';

interface LabReferenceRange {
  min?: number;
  max?: number;
  criticalMin?: number;
  criticalMax?: number;
  unit: string;
}

// Common LOINC reference ranges (simplified subset for illustration)
const LOINC_REFERENCE_RANGES: Record<string, LabReferenceRange> = {
  '2823-3': { min: 3.5, max: 5.0, criticalMin: 2.5, criticalMax: 6.5, unit: 'mEq/L' }, // Potassium
  '2160-0': { min: 0.6, max: 1.2, criticalMin: 0.1, criticalMax: 10.0, unit: 'mg/dL' }, // Creatinine
  '718-7': { min: 12.0, max: 17.5, criticalMin: 7.0, criticalMax: 20.0, unit: 'g/dL' }, // Hemoglobin
  '2339-0': { min: 70, max: 100, criticalMin: 40, criticalMax: 500, unit: 'mg/dL' }, // Glucose
  '6598-7': { min: 9.5, max: 13.5, criticalMin: 7.0, criticalMax: 15.0, unit: 'seconds' }, // PT
  '3016-3': { min: 0.4, max: 4.0, unit: 'mIU/L' }, // TSH
};

@Injectable()
export class LoincValidationService {
  private readonly logger = new Logger(LoincValidationService.name);

  constructor(
    @InjectRepository(MedicalCodeRegistry)
    private readonly codeRegistryRepo: Repository<MedicalCodeRegistry>,
  ) {}

  async validate(
    code: string,
    observedValue?: number,
    unit?: string,
  ): Promise<CodeValidationResult> {
    const result: CodeValidationResult = {
      code,
      codeSystem: 'LOINC',
      isValid: false,
      isActive: false,
      warnings: [],
      errors: [],
    };

    // 1. Format validation
    if (!LOINC_PATTERN.test(code)) {
      result.errors.push(
        `Invalid LOINC format. Expected format like "2823-3" (numeric-checkDigit). Got: "${code}"`,
      );
      return result;
    }

    // 2. Check digit validation
    const checkDigitValid = this.validateLoincCheckDigit(code);
    if (!checkDigitValid) {
      result.errors.push(`LOINC code "${code}" has an invalid check digit.`);
      return result;
    }

    // 3. Database lookup
    try {
      const dbRecord = await this.codeRegistryRepo.findOne({
        where: { codeSystem: 'LOINC', code },
      });

      if (dbRecord) {
        result.isValid = true;
        result.isActive = dbRecord.isActive;
        result.description = dbRecord.description;
        result.category = dbRecord.category;
        result.metadata = dbRecord.metadata;

        if (!dbRecord.isActive) {
          result.warnings.push(
            `LOINC code "${code}" is deprecated. Use replacement code if available.`,
          );
        }
      } else {
        result.isValid = true;
        result.isActive = true;
        result.warnings.push(
          `LOINC code "${code}" not found in local registry. Verify against LOINC.org database.`,
        );
      }
    } catch (error) {
      this.logger.error(`Database lookup failed for LOINC code ${code}`, error);
      result.warnings.push('Registry lookup unavailable; format validation only applied.');
      result.isValid = true;
    }

    // 4. Reference range validation if value provided
    if (observedValue !== undefined) {
      const rangeWarnings = this.validateReferenceRange(code, observedValue, unit);
      result.warnings.push(...rangeWarnings);

      // Check for critical values
      const criticalAlerts = this.checkCriticalValues(code, observedValue);
      if (criticalAlerts.length > 0) {
        result.metadata = { ...result.metadata, criticalAlerts };
        result.warnings.push(...criticalAlerts);
      }
    }

    // 5. Unit validation
    if (unit && observedValue !== undefined) {
      const unitWarnings = this.validateUnit(code, unit);
      result.warnings.push(...unitWarnings);
    }

    return result;
  }

  /**
   * LOINC uses the Luhn algorithm variant for check digit validation
   */
  private validateLoincCheckDigit(code: string): boolean {
    const parts = code.split('-');
    if (parts.length !== 2) return false;

    const baseCode = parts[0];
    const checkDigit = parseInt(parts[1], 10);

    if (isNaN(checkDigit)) return false;

    // Simplified LOINC check digit validation
    // Full implementation would use the official LOINC algorithm
    let sum = 0;
    for (let i = 0; i < baseCode.length; i++) {
      const digit = parseInt(baseCode[i], 10);
      if (isNaN(digit)) return false;
      sum += digit * (i % 2 === 0 ? 2 : 1);
    }

    const computedCheck = (10 - (sum % 10)) % 10;
    return computedCheck === checkDigit;
  }

  private validateReferenceRange(code: string, value: number, unit?: string): string[] {
    const warnings: string[] = [];
    const range = LOINC_REFERENCE_RANGES[code];

    if (!range) return warnings;

    if (range.min !== undefined && value < range.min) {
      warnings.push(
        `Value ${value}${unit ? ' ' + unit : ''} is below normal range (${range.min} - ${range.max} ${range.unit}) for LOINC ${code}.`,
      );
    }

    if (range.max !== undefined && value > range.max) {
      warnings.push(
        `Value ${value}${unit ? ' ' + unit : ''} is above normal range (${range.min} - ${range.max} ${range.unit}) for LOINC ${code}.`,
      );
    }

    return warnings;
  }

  private checkCriticalValues(code: string, value: number): string[] {
    const alerts: string[] = [];
    const range = LOINC_REFERENCE_RANGES[code];

    if (!range) return alerts;

    if (range.criticalMin !== undefined && value < range.criticalMin) {
      alerts.push(
        `⚠️ CRITICAL LOW: Value ${value} is below critical threshold ${range.criticalMin} for LOINC ${code}. Immediate clinical review required.`,
      );
    }

    if (range.criticalMax !== undefined && value > range.criticalMax) {
      alerts.push(
        `⚠️ CRITICAL HIGH: Value ${value} is above critical threshold ${range.criticalMax} for LOINC ${code}. Immediate clinical review required.`,
      );
    }

    return alerts;
  }

  private validateUnit(code: string, unit: string): string[] {
    const warnings: string[] = [];
    const range = LOINC_REFERENCE_RANGES[code];

    if (!range) return warnings;

    // Simple unit comparison; in production use UCUM validation
    if (range.unit && unit.toLowerCase() !== range.unit.toLowerCase()) {
      warnings.push(
        `Unit "${unit}" may not match expected unit "${range.unit}" for LOINC ${code}. Verify unit conversion.`,
      );
    }

    return warnings;
  }
}
