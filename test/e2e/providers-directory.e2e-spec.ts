import { ExecutionContext, INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import * as request from 'supertest';
import { ProviderDirectoryQueryDto } from '../../src/auth/dto/provider-directory-query.dto';
import { ProvidersController } from '../../src/auth/controllers/providers.controller';
import { OptionalJwtAuthGuard } from '../../src/auth/guards/optional-jwt-auth.guard';
import { AuthTokenService } from '../../src/auth/services/auth-token.service';
import { ProviderDirectoryService } from '../../src/auth/services/provider-directory.service';
import { SessionManagementService } from '../../src/auth/services/session-management.service';

describe('Providers Directory (e2e)', () => {
  let app: INestApplication;

  const providerDirectoryServiceMock = {
    searchProviders: jest.fn((query: ProviderDirectoryQueryDto, isAuthenticated: boolean) => {
      const page = Number(query.page || 1);
      const limit = Number(query.limit || 20);

      if (query.search === 'nomatch') {
        return {
          data: [],
          pagination: {
            page,
            limit,
            total: 0,
          },
        };
      }

      const baseRecord = {
        id: 'provider-1',
        displayName: 'Dr. Alicia Stone',
        role: 'doctor',
        specialty: 'Cardiology',
        institution: 'General Hospital',
      };

      return {
        data: [
          isAuthenticated
            ? { ...baseRecord, stellarPublicKey: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF' }
            : baseRecord,
        ],
        pagination: {
          page,
          limit,
          total: 1,
        },
      };
    }),
  };

  const authTokenServiceMock = {
    verifyAccessToken: jest.fn((token: string) => {
      if (token === 'valid-test-token') {
        return {
          userId: 'user-1',
          email: 'provider@test.com',
          role: 'physician',
          mfaEnabled: true,
          sessionId: 'session-1',
        };
      }
      return null;
    }),
  };

  const sessionManagementServiceMock = {
    isSessionValid: jest.fn(async (sessionId: string) => sessionId === 'session-1'),
    updateSessionActivity: jest.fn(async () => undefined),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([
          {
            name: 'ip',
            ttl: 60000,
            limit: 30,
            getTracker: (req) => req.headers['x-test-key'] || req.ip,
          },
          {
            name: 'user',
            ttl: 60000,
            limit: 30,
            getTracker: (req) => req.headers['x-test-key'] || req.ip,
          },
        ]),
      ],
      controllers: [ProvidersController],
      providers: [
        {
          provide: ProviderDirectoryService,
          useValue: providerDirectoryServiceMock,
        },
        {
          provide: AuthTokenService,
          useValue: authTokenServiceMock,
        },
        {
          provide: SessionManagementService,
          useValue: sessionManagementServiceMock,
        },
        {
          provide: APP_GUARD,
          useClass: ThrottlerGuard,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  beforeEach(() => {
    providerDirectoryServiceMock.searchProviders.mockClear();
    authTokenServiceMock.verifyAccessToken.mockClear();
    sessionManagementServiceMock.isSessionValid.mockClear();
    sessionManagementServiceMock.updateSessionActivity.mockClear();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('returns paginated provider list', async () => {
    const response = await request(app.getHttpServer()).get('/providers?page=2&limit=5').expect(200);

    expect(response.body.data).toHaveLength(1);
    expect(response.body.pagination).toEqual({
      page: 2,
      limit: 5,
      total: 1,
    });
    expect(providerDirectoryServiceMock.searchProviders).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, limit: 5 }),
      false,
    );
  });

  it('full-text search returns relevant results', async () => {
    const response = await request(app.getHttpServer()).get('/providers?search=alicia').expect(200);

    expect(response.body.data[0].displayName).toContain('Alicia');
    expect(providerDirectoryServiceMock.searchProviders).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'alicia' }),
      false,
    );
  });

  it('returns empty array when no match', async () => {
    const response = await request(app.getHttpServer()).get('/providers?search=nomatch').expect(200);

    expect(response.body.data).toEqual([]);
    expect(response.body.pagination.total).toBe(0);
  });

  it('excludes stellarPublicKey for unauthenticated users', async () => {
    const response = await request(app.getHttpServer()).get('/providers').expect(200);

    expect(response.body.data[0]).not.toHaveProperty('stellarPublicKey');
  });

  it('includes stellarPublicKey for authenticated users', async () => {
    const response = await request(app.getHttpServer())
      .get('/providers')
      .set('Authorization', 'Bearer valid-test-token')
      .expect(200);

    expect(response.body.data[0]).toHaveProperty('stellarPublicKey');
  });

  it('returns 401 for invalid bearer token', async () => {
    await request(app.getHttpServer())
      .get('/providers')
      .set('Authorization', 'Bearer invalid-token')
      .expect(401);
  });

  it('applies role alias filter', async () => {
    await request(app.getHttpServer()).get('/providers?role=doctor').expect(200);

    expect(providerDirectoryServiceMock.searchProviders).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'doctor' }),
      false,
    );
  });

  it('rate limits after 30 requests/min', async () => {
    const server = app.getHttpServer();
    for (let i = 0; i < 30; i++) {
      await request(server)
        .get('/providers')
        .set('X-Test-Key', 'rate-limit-scenario')
        .set('Authorization', 'Bearer valid-test-token')
        .expect(200);
    }

    await request(server)
      .get('/providers')
      .set('X-Test-Key', 'rate-limit-scenario')
      .set('Authorization', 'Bearer valid-test-token')
      .expect(429);
  });
});
