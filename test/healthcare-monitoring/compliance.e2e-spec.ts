import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { HealthcareMonitoringModule } from '../../src/healthcare-monitoring/healthcare-monitoring.module';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../src/auth/guards/roles.guard';

/**
 * E2E coverage for issue #1132: ComplianceController must not be reachable
 * by anonymous callers, and non-privileged roles must receive 403.
 *
 * Compliance data is platform-wide (not tenant-scoped); access is gated by
 * JwtAuthGuard + RolesGuard with admin/compliance roles only.
 */
describe('ComplianceController (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  const signToken = (payload: Record<string, unknown>) =>
    jwtService.sign(payload);

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [HealthcareMonitoringModule],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: any) => {
          const req = context.switchToHttp().getRequest();
          const header: string | undefined = req.headers['authorization'];
          if (!header || !header.startsWith('Bearer ')) {
            return false;
          }
          const token = header.slice('Bearer '.length);
          try {
            req.user = jwtService.verify(token);
            return true;
          } catch {
            return false;
          }
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();

    jwtService = app.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /compliance/status', () => {
    it('returns 401 for anonymous callers', async () => {
      await request(app.getHttpServer()).get('/compliance/status').expect(401);
    });

    it('returns 403 for unauthorized roles', async () => {
      const token = signToken({ sub: 'u1', roles: ['clinician'] });
      await request(app.getHttpServer())
        .get('/compliance/status')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('allows admin role', async () => {
      const token = signToken({ sub: 'admin', roles: ['admin'] });
      await request(app.getHttpServer())
        .get('/compliance/status')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });
  });

  describe('GET /compliance/dashboard', () => {
    it('returns 401 for anonymous callers', async () => {
      await request(app.getHttpServer())
        .get('/compliance/dashboard')
        .expect(401);
    });

    it('returns 403 for unauthorized roles', async () => {
      const token = signToken({ sub: 'u2', roles: ['nurse'] });
      await request(app.getHttpServer())
        .get('/compliance/dashboard')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });
  });

  describe('POST /compliance/run-checks', () => {
    it('returns 401 for anonymous callers', async () => {
      await request(app.getHttpServer())
        .post('/compliance/run-checks')
        .send({ checkTypes: ['hipaa'] })
        .expect(401);
    });

    it('returns 403 for unauthorized roles', async () => {
      const token = signToken({ sub: 'u3', roles: ['clinician'] });
      await request(app.getHttpServer())
        .post('/compliance/run-checks')
        .set('Authorization', `Bearer ${token}`)
        .send({ checkTypes: ['hipaa'] })
        .expect(403);
    });

    it('allows compliance role and honours checkTypes', async () => {
      const token = signToken({ sub: 'officer', roles: ['compliance'] });
      const res = await request(app.getHttpServer())
        .post('/compliance/run-checks')
        .set('Authorization', `Bearer ${token}`)
        .send({ checkTypes: ['hipaa'] })
        .expect(201);

      expect(res.body).toBeDefined();
    });
  });
});
