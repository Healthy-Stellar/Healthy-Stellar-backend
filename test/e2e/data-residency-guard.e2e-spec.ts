import { Controller, Get, INestApplication, Req, UseGuards } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import * as request from 'supertest';
import { DataResidencyGuard } from '../../src/data-residency/guards/data-residency.guard';
import { DataResidencyService } from '../../src/data-residency/services/data-residency.service';
import { TenantService } from '../../src/tenant/services/tenant.service';
import { Tenant } from '../../src/tenant/entities/tenant.entity';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard';
import { AuthTokenService } from '../../src/auth/services/auth-token.service';
import { SessionManagementService } from '../../src/auth/services/session-management.service';
import { DataResidencyRegion } from '../../src/enums/data-residency.enum';

const NON_EU_IP = '203.0.113.10';

@Controller('data-residency-test')
@UseGuards(JwtAuthGuard, DataResidencyGuard)
class DataResidencyTestController {
  @Get()
  getRegion(@Req() req: any) {
    return { region: req.dataRegion };
  }
}

describe('Data residency tenant enforcement (e2e) — #1189', () => {
  let app: INestApplication;

  const tenant: Partial<Tenant> = {
    id: 'eu-tenant',
    region: DataResidencyRegion.EU,
    strictDataResidency: true,
    allowedIpRanges: ['198.51.100.0/24'],
  };

  const authTokenServiceMock = {
    verifyAccessToken: jest.fn((token: string) =>
      token === 'eu-user-token'
        ? {
            userId: 'eu-user',
            email: 'eu-user@example.test',
            role: 'admin',
            mfaVerified: true,
            sessionId: 'session-eu-user',
            organizationId: 'eu-tenant',
          }
        : null,
    ),
  };

  const sessionManagementServiceMock = {
    isSessionValid: jest.fn(async () => true),
    updateSessionActivity: jest.fn(async () => undefined),
  };

  const dataResidencyServiceMock = {
    isIpAllowedForRegion: jest.fn(
      (_region: DataResidencyRegion, ip: string) => ip !== NON_EU_IP,
    ),
  };

  const tenantServiceMock = {
    findById: jest.fn(async () => tenant),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [DataResidencyTestController],
      providers: [
        JwtAuthGuard,
        DataResidencyGuard,
        { provide: AuthTokenService, useValue: authTokenServiceMock },
        { provide: SessionManagementService, useValue: sessionManagementServiceMock },
        { provide: DataResidencyService, useValue: dataResidencyServiceMock },
        { provide: TenantService, useValue: tenantServiceMock },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: string) =>
              key === 'DATA_RESIDENCY_TRUSTED_PROXIES'
                ? '127.0.0.1,::1,::ffff:127.0.0.1'
                : defaultValue,
            ),
          },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use((req: any, _res: any, next: () => void) => {
      Object.defineProperty(req.socket, 'remoteAddress', {
        configurable: true,
        value: '127.0.0.1',
      });
      next();
    });
    await app.init();
  });

  beforeEach(() => jest.clearAllMocks());

  afterAll(async () => {
    if (app) await app.close();
  });

  it('rejects a strict-EU tenant request originating from a non-EU IP', async () => {
    await request(app.getHttpServer())
      .get('/data-residency-test')
      .set('Authorization', 'Bearer eu-user-token')
      .set('X-Forwarded-For', NON_EU_IP)
      .expect(403);

    expect(tenantServiceMock.findById).toHaveBeenCalledWith('eu-tenant');
    expect(dataResidencyServiceMock.isIpAllowedForRegion).toHaveBeenCalledWith(
      DataResidencyRegion.EU,
      NON_EU_IP,
      tenant.allowedIpRanges,
    );
  });
});
