import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { TreatmentPlanningController } from '../src/treatment-planning/treatment-planning.controller';
import { TreatmentPlanningService } from '../src/treatment-planning/treatment-planning.service';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../src/auth/guards/roles.guard';
import { AuthTokenService } from '../src/auth/services/auth-token.service';
import { SecretRotationService } from '../src/auth/services/secret-rotation.service';
import { SessionManagementService } from '../src/auth/services/session-management.service';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../src/auth/entities/user.entity';

describe('Treatment Planning Authentication & Plan Creation (e2e)', () => {
  let app: INestApplication;
  let authTokenService: Partial<AuthTokenService>;
  let secretRotationService: Partial<SecretRotationService>;
  let sessionManagementService: Partial<SessionManagementService>;
  let treatmentPlanningService: Partial<TreatmentPlanningService>;

  const validToken = 'valid-hs512-bearer-token';
  const testUserId = 'doc-1234-uuid';
  const testSessionId = 'sess-5678-uuid';

  beforeAll(async () => {
    secretRotationService = {
      activeSecret: 'a-very-secure-secret-key-that-is-longer-than-32-chars-for-hs512',
      verify: jest.fn().mockImplementation((token: string) => {
        if (token === validToken) {
          return {
            userId: testUserId,
            email: 'physician@healthystellar.org',
            role: UserRole.PHYSICIAN,
            mfaEnabled: true,
            sessionId: testSessionId,
            organizationId: 'org-main',
          };
        }
        return null;
      }),
    };

    authTokenService = {
      verifyAccessToken: jest.fn().mockImplementation((token: string) => {
        if (token === validToken) {
          return {
            userId: testUserId,
            email: 'physician@healthystellar.org',
            role: UserRole.PHYSICIAN,
            mfaEnabled: true,
            sessionId: testSessionId,
            organizationId: 'org-main',
          };
        }
        return null;
      }),
    };

    sessionManagementService = {
      isSessionValid: jest.fn().mockImplementation((sessionId: string) => {
        return Promise.resolve(sessionId === testSessionId);
      }),
      updateSessionActivity: jest.fn().mockResolvedValue(undefined),
    };

    treatmentPlanningService = {
      savePlan: jest.fn().mockImplementation((planId: string, updateData: any, authorId: string) => {
        return Promise.resolve({
          id: planId,
          ...updateData,
          authorId,
          version: 1,
          createdAt: new Date().toISOString(),
        });
      }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [TreatmentPlanningController],
      providers: [
        {
          provide: TreatmentPlanningService,
          useValue: treatmentPlanningService,
        },
        {
          provide: AuthTokenService,
          useValue: authTokenService,
        },
        {
          provide: SecretRotationService,
          useValue: secretRotationService,
        },
        {
          provide: SessionManagementService,
          useValue: sessionManagementService,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('dummy'),
            getOrThrow: jest.fn().mockReturnValue('dummy'),
          },
        },
        Reflector,
        JwtAuthGuard,
        RolesGuard,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('rejects POST /treatment-plans/:id with 401 when no token is provided', async () => {
    await request(app.getHttpServer())
      .post('/treatment-plans/plan-001')
      .send({ diagnosis: 'Type 2 Diabetes', protocol: 'Metformin 500mg' })
      .expect(401);
  });

  it('rejects POST /treatment-plans/:id with 401 when an invalid/expired token is provided', async () => {
    await request(app.getHttpServer())
      .post('/treatment-plans/plan-001')
      .set('Authorization', 'Bearer invalid-or-expired-token')
      .send({ diagnosis: 'Type 2 Diabetes', protocol: 'Metformin 500mg' })
      .expect(401);
  });

  it('successfully updates/creates a treatment plan with a real rotating token and maps userId', async () => {
    const planPayload = {
      diagnosis: 'Hypertension Stage 1',
      medications: ['Lisinopril 10mg'],
      targetBP: '120/80',
    };

    const response = await request(app.getHttpServer())
      .post('/treatment-plans/plan-100')
      .set('Authorization', `Bearer ${validToken}`)
      .send(planPayload)
      .expect(201);

    expect(response.body).toBeDefined();
    expect(response.body.id).toBe('plan-100');
    expect(response.body.diagnosis).toBe('Hypertension Stage 1');
    expect(response.body.authorId).toBe(testUserId);

    expect(treatmentPlanningService.savePlan).toHaveBeenCalledWith(
      'plan-100',
      planPayload,
      testUserId,
    );
  });
});
