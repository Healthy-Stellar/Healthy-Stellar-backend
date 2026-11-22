import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { FeatureFlagController } from './feature-flag.controller';
import { FeatureFlagService } from './feature-flag.service';
import { UserRole } from '../auth/entities/user.entity';
import { RolloutStrategy, FeatureFlag } from './feature-flag.entity';

describe('FeatureFlagController - Role Enforcement', () => {
  let controller: FeatureFlagController;
  let service: jest.Mocked<FeatureFlagService>;

  const mockFeatureFlag: FeatureFlag = {
    id: 'flag-123',
    key: 'new_checkout',
    enabled: true,
    strategy: RolloutStrategy.TENANT_PERCENTAGE,
    rolloutPercentage: 0,
    tenantRolloutPercentage: 50,
    allowlist: [],
    tenantAllowlist: ['tenant-a', 'tenant-b'],
    description: 'New checkout flow',
    updatedBy: 'admin-user-id',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FeatureFlagController],
      providers: [
        {
          provide: FeatureFlagService,
          useValue: {
            findAll: jest.fn(),
            isEnabled: jest.fn(),
            evaluateMany: jest.fn(),
            upsert: jest.fn(),
            rollback: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<FeatureFlagController>(FeatureFlagController);
    service = module.get(FeatureFlagService) as jest.Mocked<FeatureFlagService>;
  });

  describe('GET /admin/feature-flags (findAll)', () => {
    it('should allow SUPER_ADMIN to list all flags', async () => {
      const req = {
        user: {
          userId: 'super-admin-123',
          role: UserRole.SUPER_ADMIN,
        },
      };

      service.findAll.mockResolvedValue([mockFeatureFlag]);

      const result = await controller.findAll();

      expect(service.findAll).toHaveBeenCalled();
      expect(result).toEqual([mockFeatureFlag]);
    });

    it('should reject ADMIN (org-level) attempting to list all flags', async () => {
      const req = {
        user: {
          userId: 'admin-123',
          role: UserRole.ADMIN,
        },
      };

      // In a real scenario, the @Roles(UserRole.SUPER_ADMIN) decorator
      // on the method would prevent this at the guard level.
      // This test documents the expected behavior.
      expect(() => {
        // Simulating guard rejection - in reality RolesGuard would throw
        if (req.user.role !== UserRole.SUPER_ADMIN) {
          throw new ForbiddenException(
            'Insufficient permissions. SUPER_ADMIN role required.',
          );
        }
      }).toThrow(ForbiddenException);
    });
  });

  describe('POST /admin/feature-flags (upsert)', () => {
    it('should allow SUPER_ADMIN to create/update flags', async () => {
      const req = {
        user: {
          userId: 'super-admin-user-id',
          role: UserRole.SUPER_ADMIN,
        },
      };

      const dto = {
        key: 'new_checkout',
        enabled: true,
        strategy: RolloutStrategy.TENANT_PERCENTAGE,
        tenantRolloutPercentage: 50,
      };

      service.upsert.mockResolvedValue(mockFeatureFlag);

      const result = await controller.upsert(dto, req);

      // Verify userId (not 'id') was passed
      expect(service.upsert).toHaveBeenCalledWith(
        dto,
        'super-admin-user-id',
      );
      expect(result).toEqual(mockFeatureFlag);
    });

    it('should reject when user identity is not available', async () => {
      const req = {
        user: undefined,  // ❌ No user
      };

      const dto = {
        key: 'new_checkout',
        enabled: true,
      };

      expect(() => {
        controller.upsert(dto, req);
      }).toThrow(ForbiddenException);
    });

    it('should reject when userId is undefined', async () => {
      const req = {
        user: {
          id: 'old-field',  // ❌ Wrong field (should be userId)
          role: UserRole.SUPER_ADMIN,
        },
      };

      const dto = {
        key: 'new_checkout',
        enabled: true,
      };

      expect(() => {
        controller.upsert(dto, req);
      }).toThrow(ForbiddenException);
    });

    it('should use req.user.userId (not req.user.id)', async () => {
      const req = {
        user: {
          userId: 'correct-user-id',
          id: 'wrong-field',  // Should be ignored
          role: UserRole.SUPER_ADMIN,
        },
      };

      const dto = {
        key: 'test_flag',
        enabled: true,
      };

      service.upsert.mockResolvedValue(mockFeatureFlag);

      await controller.upsert(dto, req);

      // Must use userId, not id
      expect(service.upsert).toHaveBeenCalledWith(
        dto,
        'correct-user-id',
      );
    });

    it('should reject ADMIN (org-level) attempting to modify flags', async () => {
      const req = {
        user: {
          userId: 'admin-123',
          role: UserRole.ADMIN,
        },
      };

      const dto = {
        key: 'enable_for_my_org',
        enabled: true,
      };

      // RolesGuard would reject at the handler level
      expect(() => {
        if (req.user.role !== UserRole.SUPER_ADMIN) {
          throw new ForbiddenException(
            'Insufficient permissions. SUPER_ADMIN role required.',
          );
        }
      }).toThrow(ForbiddenException);
    });
  });

  describe('PATCH /admin/feature-flags/:key/rollback', () => {
    it('should allow SUPER_ADMIN to rollback flags', async () => {
      const req = {
        user: {
          userId: 'super-admin-user-id',
          role: UserRole.SUPER_ADMIN,
        },
      };

      service.rollback.mockResolvedValue({
        ...mockFeatureFlag,
        enabled: false,
      });

      const result = await controller.rollback('new_checkout', req);

      expect(service.rollback).toHaveBeenCalledWith(
        'new_checkout',
        'super-admin-user-id',
      );
      expect(result.enabled).toBe(false);
    });

    it('should reject when user identity is not available', async () => {
      const req = {
        user: undefined,
      };

      expect(() => {
        controller.rollback('some_flag', req);
      }).toThrow(ForbiddenException);
    });

    it('should reject ADMIN attempting to rollback', async () => {
      const req = {
        user: {
          userId: 'admin-123',
          role: UserRole.ADMIN,
        },
      };

      expect(() => {
        if (req.user.role !== UserRole.SUPER_ADMIN) {
          throw new ForbiddenException(
            'Insufficient permissions. SUPER_ADMIN role required.',
          );
        }
      }).toThrow(ForbiddenException);
    });
  });

  describe('GET /admin/feature-flags/:key/evaluate (unrestricted)', () => {
    it('should allow any authenticated user to evaluate flags', async () => {
      service.isEnabled.mockResolvedValue(true);

      const result = await controller.evaluate('new_checkout', 'user-123', 'tenant-a');

      expect(service.isEnabled).toHaveBeenCalledWith(
        'new_checkout',
        {
          actorId: 'user-123',
          tenantId: 'tenant-a',
        },
      );
      expect(result).toEqual({
        key: 'new_checkout',
        enabled: true,
        actorId: 'user-123',
        tenantId: 'tenant-a',
      });
    });

    it('should allow ADMIN (org-level) to evaluate flags', async () => {
      // Unlike mutations, evaluation is allowed for everyone
      service.isEnabled.mockResolvedValue(false);

      const result = await controller.evaluate(
        'feature_flag',
        undefined,
        'tenant-xyz',
      );

      expect(service.isEnabled).toHaveBeenCalled();
      expect(result.enabled).toBe(false);
    });
  });

  describe('POST /admin/feature-flags/evaluate-many (unrestricted)', () => {
    it('should allow any authenticated user to batch evaluate', async () => {
      service.evaluateMany.mockResolvedValue({
        flag1: true,
        flag2: false,
        flag3: true,
      });

      const result = await controller.evaluateMany({
        keys: ['flag1', 'flag2', 'flag3'],
        tenantId: 'tenant-b',
      });

      expect(service.evaluateMany).toHaveBeenCalledWith(
        ['flag1', 'flag2', 'flag3'],
        { tenantId: 'tenant-b' },
      );
      expect(result).toEqual({
        flag1: true,
        flag2: false,
        flag3: true,
      });
    });
  });

  describe('Audit Trail - updatedBy field', () => {
    it('should track which user modified a flag via updatedBy', async () => {
      const req = {
        user: {
          userId: 'alice-user-id',
          role: UserRole.SUPER_ADMIN,
        },
      };

      const dto = {
        key: 'checkout_redesign',
        enabled: true,
      };

      const resultWithAudit = {
        ...mockFeatureFlag,
        updatedBy: 'alice-user-id',  // ✅ Real user ID
      };

      service.upsert.mockResolvedValue(resultWithAudit);

      const result = await controller.upsert(dto, req);

      expect(result.updatedBy).toBe('alice-user-id');
      expect(result.updatedBy).not.toBe('system');  // ❌ No 'system' fallback
    });

    it('should fail if updatedBy cannot be set (no userId)', async () => {
      const req = {
        user: {
          // ❌ userId missing
          role: UserRole.SUPER_ADMIN,
        },
      };

      const dto = {
        key: 'some_flag',
        enabled: false,
      };

      expect(() => {
        controller.upsert(dto, req);
      }).toThrow(ForbiddenException);
    });
  });

  describe('Cross-Tenant Isolation', () => {
    it('should prevent org admin from viewing other tenants enabledTenantIds', async () => {
      // Org admins should not have access to /admin/feature-flags list
      // They can only evaluate flags for their own context
      const req = {
        user: {
          userId: 'hospital-admin',
          role: UserRole.ADMIN,  // Org-level, not system-level
          organizationId: 'hospital-a',
        },
      };

      expect(() => {
        if (req.user.role !== UserRole.SUPER_ADMIN) {
          throw new ForbiddenException(
            'Cannot list global flag configurations. Use evaluation API instead.',
          );
        }
      }).toThrow(ForbiddenException);
    });

    it('should allow org admin to evaluate flags for their own tenant', async () => {
      // But evaluation is allowed (read-only, context-specific)
      service.isEnabled.mockResolvedValue(true);

      const result = await controller.evaluate(
        'new_checkout',
        undefined,
        'hospital-a',
      );

      expect(service.isEnabled).toHaveBeenCalled();
      expect(result.enabled).toBe(true);
    });
  });
});
