import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MedicalCodeRegistry } from '../entities/medical-validation.entities';
import { CodeValidationResult } from '../interfaces/validation-result.interface';
import { ICD10_CHAPTERS, ICD10_PATTERN } from '../medical-codes.constants';

@Injectable()
export class Icd10ValidationService {
  private readonly logger = new Logger(Icd10ValidationService.name);

  constructor(
    @InjectRepository(MedicalCodeRegistry)
    private readonly codeRegistryRepo: Repository<MedicalCodeRegistry>,
  ) {}

  async validate(code: string, codeYear?: string): Promise<CodeValidationResult> {
    const result: CodeValidationResult = {
      code,
      codeSystem: 'ICD-10',
      isValid: false,
      isActive: false,
      warnings: [],
      errors: [],
    };

    // 1. Format validation
    if (!ICD10_PATTERN.test(code)) {
      result.errors.push(
        `Invalid ICD-10 format. Expected pattern like "J18.9" or "A01". Got: "${code}"`,
      );
      return result;
    }

    // 2. Chapter validation
    const chapter = code.charAt(0);
    if (!ICD10_CHAPTERS[chapter]) {
      result.errors.push(`Unknown ICD-10 chapter prefix: "${chapter}"`);
      return result;
    }

    result.category = ICD10_CHAPTERS[chapter];

    // 3. Special code checks
    this.checkSpecialIcd10Codes(code, result);

    // 4. Database lookup for active status
    try {
      const dbRecord = await this.codeRegistryRepo.findOne({
        where: { codeSystem: 'ICD-10', code: code.toUpperCase() },
      });

      if (dbRecord) {
        result.isValid = true;
        result.isActive = dbRecord.isActive;
        result.description = dbRecord.description;

        if (!dbRecord.isActive) {
          result.warnings.push(
            `ICD-10 code "${code}" has been deprecated. Please use the updated equivalent.`,
          );
        }

        if (dbRecord.expiryDate && new Date(dbRecord.expiryDate) < new Date()) {
          result.warnings.push(`ICD-10 code "${code}" expired on ${dbRecord.expiryDate}`);
        }

        result.metadata = dbRecord.metadata;
      } else {
        // Code passes format validation but not in our registry
        result.isValid = true; // format is valid
        result.isActive = true; // assume active if not in DB
        result.warnings.push(
          `ICD-10 code "${code}" is not in local registry. Verify against current ICD-10-CM tables.`,
        );
      }
    } catch (error) {
      this.logger.error(`Database lookup failed for ICD-10 code ${code}`, error);
      result.warnings.push('Registry lookup unavailable; format validation only applied.');
      result.isValid = true;
    }

    return result;
  }

  async validateCrosswalk(
    icd10Code: string,
    cptCodes: string[],
  ): Promise<{
    isCompatible: boolean;
    incompatibleCodes: string[];
    warnings: string[];
  }> {
    // In production this would check CMS crosswalk tables
    const warnings: string[] = [];
    const incompatibleCodes: string[] = [];

    // Example: Z-codes (factors influencing health) typically aren't primary diagnoses with procedures
    if (icd10Code.startsWith('Z') && cptCodes.length > 0) {
      warnings.push(
        `ICD-10 Z-code "${icd10Code}" used as primary diagnosis. Verify medical necessity.`,
      );
    }

    return {
      isCompatible: incompatibleCodes.length === 0,
      incompatibleCodes,
      warnings,
    };
  }

  private checkSpecialIcd10Codes(code: string, result: CodeValidationResult): void {
    // Placeholder codes - not valid for billing
    if (code.endsWith('XXX') || code.includes('X')) {
      if (code.includes('XXX')) {
        result.warnings.push(
          `Code "${code}" appears to be a placeholder (X fill). Verify this is intentional.`,
        );
      }
    }

    // Codes that require 7th character
    const requiresSeverity = ['S', 'T'].includes(code.charAt(0));
    if (requiresSeverity && code.split('.').length > 1) {
      const extension = code.split('.')[1];
      if (extension && !['A', 'D', 'S'].includes(extension.charAt(extension.length - 1))) {
        // S=sequela, D=subsequent, A=initial - these are common 7th chars for injury codes
      }
    }
  }
}
