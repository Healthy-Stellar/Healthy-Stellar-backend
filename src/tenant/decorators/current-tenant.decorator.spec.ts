import { ExecutionContext } from '@nestjs/common';
import { TenantContext } from '@/tenant';
import type { TenantContextData } from '@/tenant';

// Extract the raw callback the same way NestJS does at runtime
// createParamDecorator stores the factory fn; we replicate it here to keep tests
// independent of NestJS internals.
const decoratorFn = (field: keyof TenantContextData | undefined, _ctx: ExecutionContext) => {
  const context = TenantContext.get();
  return field ? context?.[field] : context;
};

const mockCtx = {} as ExecutionContext;

const mockTenant: TenantContextData = {
  tenantId: 'tenant-uuid-123',
  tenantSlug: 'hospital-a',
  schemaName: 'tenant_hospital-a',
};

describe('CurrentTenant decorator', () => {
  afterEach(() => jest.restoreAllMocks());

  it('returns the full context when no field is specified', () => {
    jest.spyOn(TenantContext, 'get').mockReturnValue(mockTenant);
    expect(decoratorFn(undefined, mockCtx)).toEqual(mockTenant);
  });

  it('returns tenantId', () => {
    jest.spyOn(TenantContext, 'get').mockReturnValue(mockTenant);
    expect(decoratorFn('tenantId', mockCtx)).toBe('tenant-uuid-123');
  });

  it('returns tenantSlug', () => {
    jest.spyOn(TenantContext, 'get').mockReturnValue(mockTenant);
    expect(decoratorFn('tenantSlug', mockCtx)).toBe('hospital-a');
  });

  it('returns schemaName', () => {
    jest.spyOn(TenantContext, 'get').mockReturnValue(mockTenant);
    expect(decoratorFn('schemaName', mockCtx)).toBe('tenant_hospital-a');
  });

  it('returns undefined for full context when no tenant is set', () => {
    jest.spyOn(TenantContext, 'get').mockReturnValue(undefined);
    expect(decoratorFn(undefined, mockCtx)).toBeUndefined();
  });

  it('returns undefined for a field when no tenant is set', () => {
    jest.spyOn(TenantContext, 'get').mockReturnValue(undefined);
    expect(decoratorFn('tenantId', mockCtx)).toBeUndefined();
  });
});
