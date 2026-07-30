import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { TenantFieldValidationService } from './tenant-field-validation.service';
import {
  TenantFieldRuleType,
  TenantFieldValidationRule,
} from '../entities/tenant-field-validation-rule.entity';

describe('TenantFieldValidationService', () => {
  let service: TenantFieldValidationService;
  let rules: TenantFieldValidationRule[];

  const mockRepo = {
    find: jest
      .fn()
      .mockImplementation(({ where }) =>
        Promise.resolve(
          rules.filter(
            (r) =>
              r.tenantId === where.tenantId &&
              (where.isActive === undefined || r.isActive === where.isActive),
          ),
        ),
      ),
    findOne: jest
      .fn()
      .mockImplementation(({ where }) =>
        Promise.resolve(
          rules.find((r) => r.id === where.id && r.tenantId === where.tenantId) ?? null,
        ),
      ),
    create: jest
      .fn()
      .mockImplementation((data) => ({ id: `rule-${rules.length + 1}`, isActive: true, ...data })),
    save: jest.fn().mockImplementation((rule) => {
      const idx = rules.findIndex((r) => r.id === rule.id);
      if (idx >= 0) rules[idx] = rule;
      else rules.push(rule);
      return Promise.resolve(rule);
    }),
  };

  beforeEach(async () => {
    rules = [];
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantFieldValidationService,
        { provide: getRepositoryToken(TenantFieldValidationRule), useValue: mockRepo },
      ],
    }).compile();

    service = module.get(TenantFieldValidationService);
  });

  describe('createRule', () => {
    it('rejects a REGEX rule with no pattern', async () => {
      await expect(
        service.createRule('tenant-a', {
          fieldName: 'insuranceNumber',
          type: TenantFieldRuleType.REGEX,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a REGEX rule with an invalid pattern', async () => {
      await expect(
        service.createRule('tenant-a', {
          fieldName: 'insuranceNumber',
          type: TenantFieldRuleType.REGEX,
          pattern: '(unterminated',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('accepts a valid REGEX rule', async () => {
      const rule = await service.createRule('tenant-a', {
        fieldName: 'insuranceNumber',
        type: TenantFieldRuleType.REGEX,
        pattern: '^INS-\\d{6}$',
        required: true,
      });
      expect(rule.fieldName).toBe('insuranceNumber');
    });
  });

  describe('validateFields — tenant rule precedence and fallback', () => {
    it('applies the tenant rule when one exists for the field', async () => {
      await service.createRule('tenant-a', {
        fieldName: 'insuranceNumber',
        type: TenantFieldRuleType.REGEX,
        pattern: '^INS-\\d{6}$',
        required: true,
        errorMessage: 'Invalid insurance number format',
      });

      await expect(
        service.validateFields('tenant-a', { insuranceNumber: 'not-a-match' }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.validateFields('tenant-a', { insuranceNumber: 'INS-123456' }),
      ).resolves.toBeUndefined();
    });

    it('falls back to no custom validation when no tenant rule exists for the field', async () => {
      await service.createRule('tenant-a', {
        fieldName: 'insuranceNumber',
        type: TenantFieldRuleType.REGEX,
        pattern: '^INS-\\d{6}$',
      });

      // "localBenefitId" has no rule for tenant-a — should pass through untouched.
      await expect(
        service.validateFields('tenant-a', { localBenefitId: 'anything-goes' }),
      ).resolves.toBeUndefined();
    });

    it("does not apply another tenant's rules", async () => {
      await service.createRule('tenant-a', {
        fieldName: 'insuranceNumber',
        type: TenantFieldRuleType.REGEX,
        pattern: '^INS-\\d{6}$',
        required: true,
      });

      // tenant-b has no rules at all, so the same field is unconstrained.
      await expect(
        service.validateFields('tenant-b', { insuranceNumber: 'anything' }),
      ).resolves.toBeUndefined();
    });

    it('rejects missing required fields', async () => {
      await service.createRule('tenant-a', {
        fieldName: 'insuranceNumber',
        required: true,
      });

      await expect(service.validateFields('tenant-a', {})).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateRule', () => {
    it('throws NotFoundException for a rule belonging to a different tenant', async () => {
      const rule = await service.createRule('tenant-a', { fieldName: 'insuranceNumber' });

      await expect(service.updateRule('tenant-b', rule.id, { required: true })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects switching an existing rule to REGEX without providing a pattern', async () => {
      const rule = await service.createRule('tenant-a', { fieldName: 'insuranceNumber' });

      await expect(
        service.updateRule('tenant-a', rule.id, { type: TenantFieldRuleType.REGEX }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
