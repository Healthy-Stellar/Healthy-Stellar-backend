import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  TenantFieldRuleType,
  TenantFieldValidationRule,
} from '../entities/tenant-field-validation-rule.entity';
import {
  CreateTenantFieldValidationRuleDto,
  UpdateTenantFieldValidationRuleDto,
} from '../dto/tenant-field-validation-rule.dto';

/**
 * Loads and applies tenant-specific custom-field validation rules.
 * Fields with no matching active rule for the tenant are left to whatever
 * default validation the caller already applies (fallback behaviour).
 */
@Injectable()
export class TenantFieldValidationService {
  constructor(
    @InjectRepository(TenantFieldValidationRule)
    private readonly ruleRepo: Repository<TenantFieldValidationRule>,
  ) {}

  async listRules(tenantId: string): Promise<TenantFieldValidationRule[]> {
    return this.ruleRepo.find({ where: { tenantId }, order: { fieldName: 'ASC' } });
  }

  async createRule(
    tenantId: string,
    dto: CreateTenantFieldValidationRuleDto,
  ): Promise<TenantFieldValidationRule> {
    this.assertValidRuleDefinition(dto.type ?? TenantFieldRuleType.STRING, dto.pattern);

    const rule = this.ruleRepo.create({
      tenantId,
      fieldName: dto.fieldName,
      type: dto.type ?? TenantFieldRuleType.STRING,
      pattern: dto.pattern ?? null,
      required: dto.required ?? false,
      errorMessage: dto.errorMessage ?? null,
    });

    return this.ruleRepo.save(rule);
  }

  async updateRule(
    tenantId: string,
    ruleId: string,
    dto: UpdateTenantFieldValidationRuleDto,
  ): Promise<TenantFieldValidationRule> {
    const rule = await this.ruleRepo.findOne({ where: { id: ruleId, tenantId } });
    if (!rule) throw new NotFoundException('Validation rule not found for this tenant');

    const nextType = dto.type ?? rule.type;
    const nextPattern = dto.pattern !== undefined ? dto.pattern : rule.pattern;
    this.assertValidRuleDefinition(nextType, nextPattern ?? undefined);

    Object.assign(rule, {
      type: nextType,
      pattern: nextPattern ?? null,
      required: dto.required ?? rule.required,
      errorMessage: dto.errorMessage ?? rule.errorMessage,
      isActive: dto.isActive ?? rule.isActive,
    });

    return this.ruleRepo.save(rule);
  }

  /**
   * Validates a custom-fields bag against the tenant's active rules.
   * Throws BadRequestException listing every violation. Fields without a
   * matching active rule are not validated here (fallback to default).
   */
  async validateFields(tenantId: string, fields: Record<string, unknown>): Promise<void> {
    const rules = await this.ruleRepo.find({ where: { tenantId, isActive: true } });
    if (rules.length === 0) return;

    const violations: string[] = [];
    for (const rule of rules) {
      const value = fields?.[rule.fieldName];
      const isEmpty = value === undefined || value === null || value === '';

      if (rule.required && isEmpty) {
        violations.push(rule.errorMessage ?? `${rule.fieldName} is required`);
        continue;
      }

      if (isEmpty) continue; // optional and not provided — nothing further to check

      if (!this.matchesType(rule, value)) {
        violations.push(rule.errorMessage ?? `${rule.fieldName} is invalid`);
      }
    }

    if (violations.length > 0) {
      throw new BadRequestException({ message: 'Custom field validation failed', violations });
    }
  }

  private matchesType(rule: TenantFieldValidationRule, value: unknown): boolean {
    switch (rule.type) {
      case TenantFieldRuleType.NUMBER:
        return (
          typeof value === 'number' || (typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value))
        );
      case TenantFieldRuleType.REGEX:
        return typeof value === 'string' && new RegExp(rule.pattern ?? '.*').test(value);
      case TenantFieldRuleType.STRING:
      default:
        return typeof value === 'string';
    }
  }

  /** Rejects rule definitions that could never validate anything correctly. */
  private assertValidRuleDefinition(type: TenantFieldRuleType, pattern?: string): void {
    if (type === TenantFieldRuleType.REGEX) {
      if (!pattern) {
        throw new BadRequestException('A REGEX rule requires a pattern');
      }
      try {
        new RegExp(pattern);
      } catch {
        throw new BadRequestException(`Invalid regex pattern: ${pattern}`);
      }
    }
  }
}
