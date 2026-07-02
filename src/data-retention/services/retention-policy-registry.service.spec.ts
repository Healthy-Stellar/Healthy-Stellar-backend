import { Test, TestingModule } from '@nestjs/testing';
import { RetentionPolicyRegistryService } from './retention-policy-registry.service';

describe('RetentionPolicyRegistryService', () => {
  let service: RetentionPolicyRegistryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RetentionPolicyRegistryService],
    }).compile();

    service = module.get(RetentionPolicyRegistryService);
  });

  describe('getEffectivePolicy', () => {
    it('returns the global default for medical_records (7 years)', () => {
      const policy = service.getEffectivePolicy('medical_records', null);
      expect(policy.retentionDays).toBe(7 * 365);
      expect(policy.action).toBe('anonymize');
    });

    it('returns the global default for session_tokens (90 days)', () => {
      const policy = service.getEffectivePolicy('session_tokens', null);
      expect(policy.retentionDays).toBe(90);
      expect(policy.action).toBe('archive_and_delete');
    });

    it('returns the global default for appointment_logs (7 years)', () => {
      const policy = service.getEffectivePolicy('appointment_logs', null);
      expect(policy.retentionDays).toBe(7 * 365);
    });

    it('falls back to the global default when tenantId has no override', () => {
      const policy = service.getEffectivePolicy('medical_records', 'unregistered-tenant');
      expect(policy.retentionDays).toBe(7 * 365);
    });
  });

  describe('tenant-specific overrides', () => {
    it('applies a tenant override for a single entity type', () => {
      service.setTenantOverride({
        tenantId: 'eu-tenant',
        policies: {
          medical_records: { retentionDays: 10 * 365, action: 'soft_delete' },
        },
      });

      const policy = service.getEffectivePolicy('medical_records', 'eu-tenant');
      expect(policy.retentionDays).toBe(10 * 365);
      expect(policy.action).toBe('soft_delete');
      expect(policy.id).toBe('default-medical_records:tenant:eu-tenant');
    });

    it('falls back to the global default for entity types not covered by the override', () => {
      service.setTenantOverride({
        tenantId: 'partial-tenant',
        policies: {
          session_tokens: { retentionDays: 30 },
        },
      });

      const policy = service.getEffectivePolicy('audit_logs', 'partial-tenant');
      expect(policy.retentionDays).toBe(7 * 365);
    });

    it('applies a partial override, inheriting unspecified fields from the default', () => {
      service.setTenantOverride({
        tenantId: 'short-session-tenant',
        policies: {
          session_tokens: { retentionDays: 30 },
        },
      });

      const policy = service.getEffectivePolicy('session_tokens', 'short-session-tenant');
      expect(policy.retentionDays).toBe(30);
      // action not overridden -> inherited from default
      expect(policy.action).toBe('archive_and_delete');
    });

    it('clearTenantOverride reverts a tenant fully back to global defaults', () => {
      service.setTenantOverride({
        tenantId: 'eu-tenant',
        policies: { medical_records: { retentionDays: 10 * 365 } },
      });
      service.clearTenantOverride('eu-tenant');

      const policy = service.getEffectivePolicy('medical_records', 'eu-tenant');
      expect(policy.retentionDays).toBe(7 * 365);
    });

    it('getOverriddenTenantIds lists every tenant with a registered override', () => {
      service.setTenantOverride({ tenantId: 'tenant-a', policies: {} });
      service.setTenantOverride({ tenantId: 'tenant-b', policies: {} });

      expect(service.getOverriddenTenantIds().sort()).toEqual(['tenant-a', 'tenant-b']);
    });
  });

  describe('getCutoffDate', () => {
    it('computes a cutoff N days in the past for a day-based policy', () => {
      const policy = service.getEffectivePolicy('session_tokens', null);
      const now = new Date('2026-06-29T00:00:00.000Z');
      const cutoff = service.getCutoffDate(policy, now);

      const expected = new Date(now);
      expected.setDate(expected.getDate() - 90);
      expect(cutoff.toISOString()).toBe(expected.toISOString());
    });
  });
});
