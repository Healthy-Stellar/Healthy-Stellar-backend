import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { GeoRestrictionGuard } from './geo-restriction.guard';
import { PatientsService } from '../patients.service';
import * as geoip from 'geoip-lite';

jest.mock('geoip-lite');

const mockGeoip = geoip as jest.Mocked<typeof geoip>;

function buildContext(
  ip: string,
  role?: string,
  address = 'patient-uuid-1',
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        ip,
        headers: {},
        params: { address },
        user: role ? { role } : undefined,
      }),
    }),
  } as unknown as ExecutionContext;
}

describe('GeoRestrictionGuard', () => {
  let guard: GeoRestrictionGuard;
  let patientsService: jest.Mocked<Pick<PatientsService, 'findById'>>;

  beforeEach(() => {
    patientsService = { findById: jest.fn() };
    guard = new GeoRestrictionGuard(patientsService as unknown as PatientsService);
  });

  afterEach(() => jest.clearAllMocks());

  it('allows access when requester country is in the allowed list', async () => {
    patientsService.findById.mockResolvedValue({ allowedCountries: ['US', 'GB'] } as any);
    mockGeoip.lookup.mockReturnValue({ country: 'US' } as any);

    await expect(guard.canActivate(buildContext('1.2.3.4'))).resolves.toBe(true);
  });

  it('blocks access when requester country is NOT in the allowed list', async () => {
    patientsService.findById.mockResolvedValue({ allowedCountries: ['US', 'GB'] } as any);
    mockGeoip.lookup.mockReturnValue({ country: 'CN' } as any);

    await expect(guard.canActivate(buildContext('5.6.7.8'))).rejects.toThrow(ForbiddenException);
  });

  it('blocks access when IP cannot be geolocated', async () => {
    patientsService.findById.mockResolvedValue({ allowedCountries: ['US'] } as any);
    mockGeoip.lookup.mockReturnValue(null);

    await expect(guard.canActivate(buildContext('127.0.0.1'))).rejects.toThrow(ForbiddenException);
  });

  it('bypasses geo restriction for admin role without calling findById', async () => {
    const result = await guard.canActivate(buildContext('5.6.7.8', 'admin'));

    expect(result).toBe(true);
    expect(patientsService.findById).not.toHaveBeenCalled();
  });

  it('allows access when no restrictions are configured (empty array)', async () => {
    patientsService.findById.mockResolvedValue({ allowedCountries: [] } as any);
    mockGeoip.lookup.mockReturnValue({ country: 'RU' } as any);

    await expect(guard.canActivate(buildContext('9.9.9.9'))).resolves.toBe(true);
  });

  it('allows access when allowedCountries is null', async () => {
    patientsService.findById.mockResolvedValue({ allowedCountries: null } as any);
    mockGeoip.lookup.mockReturnValue({ country: 'BR' } as any);

    await expect(guard.canActivate(buildContext('10.0.0.1'))).resolves.toBe(true);
  });

  it('warns but does NOT block when VPN/proxy IP resolves to an allowed country', async () => {
    patientsService.findById.mockResolvedValue({ allowedCountries: ['US'] } as any);
    mockGeoip.lookup.mockReturnValue({ country: 'US', org: 'Amazon AWS' } as any);

    await expect(guard.canActivate(buildContext('3.3.3.3'))).resolves.toBe(true);
  });

  it('is case-insensitive for country codes in the allowed list', async () => {
    patientsService.findById.mockResolvedValue({ allowedCountries: ['us', 'gb'] } as any);
    mockGeoip.lookup.mockReturnValue({ country: 'US' } as any);

    await expect(guard.canActivate(buildContext('1.2.3.4'))).resolves.toBe(true);
  });

  it('resolves IP from x-forwarded-for header when present', async () => {
    patientsService.findById.mockResolvedValue({ allowedCountries: ['DE'] } as any);
    mockGeoip.lookup.mockReturnValue({ country: 'DE' } as any);

    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({
          ip: '10.0.0.1',
          headers: { 'x-forwarded-for': '203.0.113.5, 10.0.0.1' },
          params: { address: 'patient-uuid-1' },
          user: undefined,
        }),
      }),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(mockGeoip.lookup).toHaveBeenCalledWith('203.0.113.5');
  });

  it('returns true when no patient address param is present', async () => {
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({ ip: '1.2.3.4', headers: {}, params: {}, user: undefined }),
      }),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(patientsService.findById).not.toHaveBeenCalled();
  });
});
