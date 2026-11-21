import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { MedicalValidationController } from '../../src/data-validation-integrity/medical-validation.controller';
import { MedicalValidationService } from '../../src/data-validation-integrity/medical-validation.service';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../src/auth/guards/roles.guard';

describe('MedicalValidationController (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  const medicalValidationService = {
    getClinicalAlerts: jest.fn().mockResolvedValue([{ id: 'alert-1', patientId: 'patient-1' }]),
    acknowledgeAlert: jest.fn().mockResolvedValue({ id: 'alert-1', resolvedBy: 'clinician-1' }),
    enforceGovernance: jest.fn().mockResolvedValue({ enforced: true }),
    detectPhi: jest.fn().mockResolvedValue({ detected: false }),
  };

  const signToken = (payload: Record<string, any>) => jwtService.sign(payload);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [MedicalValidationController],
      providers: [
        { provide: MedicalValidationService, useValue: medicalValidationService },
        JwtAuthGuard,
        RolesGuard,
        {
          provide: JwtService,
          useValue: {
            verify: jest.fn((token: string) => JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString())),
            sign: jest.fn((payload: Record<string, any>) => {
              const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
              const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
              return `${header}.${body}.`;
            }),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx: any) => {
          const req = ctx.switchToHttp().getRequest();
          const auth = req.headers.authorization;
          if (!auth || !auth.startsWith('Bearer ')) {
            return false;
          }
          try {
            req.user = JSON.parse(Buffer.from(auth.split(' ')[1].split('.')[1], 'base64').toString());
            return true;
          } catch {
            return false;
          }
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    jwtService = moduleRef.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /medical-validation/clinical-alerts/:patientId', () => {
    it('rejects unauthenticated requests', async () => {
      await request(app.getHttpServer())
        .get('/medical-validation/clinical-alerts/patient-1')
        .expect(401);
      expect(medicalValidationService.getClinicalAlerts).not.toHaveBeenCalled();
    });

    it('rejects non-clinical roles', async () => {
      const token = signToken({ sub: 'user-1', role: 'patient' });
      await request(app.getHttpServer())
        .get('/medical-validation/clinical-alerts/patient-1')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
      expect(medicalValidationService.getClinicalAlerts).not.toHaveBeenCalled();
    });

    it('allows clinical roles to read alerts', async () => {
      const token = signToken({ sub: 'clinician-1', role: 'physician' });
      await request(app.getHttpServer())
        .get('/medical-validation/clinical-alerts/patient-1')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(medicalValidationService.getClinicalAlerts).toHaveBeenCalledWith('patient-1');
    });
  });

  describe('PATCH /medical-validation/clinical-alerts/:alertId/acknowledge', () => {
    it('rejects unauthenticated requests', async () => {
      await request(app.getHttpServer())
        .patch('/medical-validation/clinical-alerts/alert-1/acknowledge')
        .send({ overrideReason: 'test' })
        .expect(401);
      expect(medicalValidationService.acknowledgeAlert).not.toHaveBeenCalled();
    });

    it('rejects non-clinical roles', async () => {
      const token = signToken({ sub: 'user-1', role: 'patient' });
      await request(app.getHttpServer())
        .patch('/medical-validation/clinical-alerts/alert-1/acknowledge')
        .set('Authorization', `Bearer ${token}`)
        .send({ overrideReason: 'test' })
        .expect(403);
      expect(medicalValidationService.acknowledgeAlert).not.toHaveBeenCalled();
    });

    it('uses resolvedBy from the authenticated user, ignoring body.resolvedBy', async () => {
      const token = signToken({ sub: 'clinician-1', role: 'physician' });
      await request(app.getHttpServer())
        .patch('/medical-validation/clinical-alerts/alert-1/acknowledge')
        .set('Authorization', `Bearer ${token}`)
        .send({ overrideReason: 'allergy confirmed', resolvedBy: 'someone-else' })
        .expect(200);
      expect(medicalValidationService.acknowledgeAlert).toHaveBeenCalledWith(
        'alert-1',
        expect.objectContaining({ resolvedBy: 'clinician-1', overrideReason: 'allergy confirmed' }),
      );
    });
  });

  describe('governance endpoints', () => {
    it('rejects unauthenticated governance/enforce', async () => {
      await request(app.getHttpServer())
        .post('/medical-validation/governance/enforce')
        .send({})
        .expect(401);
      expect(medicalValidationService.enforceGovernance).not.toHaveBeenCalled();
    });

    it('rejects clinical roles on governance/enforce', async () => {
      const token = signToken({ sub: 'clinician-1', role: 'physician' });
      await request(app.getHttpServer())
        .post('/medical-validation/governance/enforce')
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(403);
      expect(medicalValidationService.enforceGovernance).not.toHaveBeenCalled();
    });

    it('allows admin on governance/enforce', async () => {
      const token = signToken({ sub: 'admin-1', role: 'admin' });
      await request(app.getHttpServer())
        .post('/medical-validation/governance/enforce')
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(201);
      expect(medicalValidationService.enforceGovernance).toHaveBeenCalled();
    });

    it('rejects unauthenticated governance/detect-phi', async () => {
      await request(app.getHttpServer())
        .post('/medical-validation/governance/detect-phi')
        .send({})
        .expect(401);
      expect(medicalValidationService.detectPhi).not.toHaveBeenCalled();
    });

    it('allows compliance role on governance/detect-phi', async () => {
      const token = signToken({ sub: 'compliance-1', role: 'compliance' });
      await request(app.getHttpServer())
        .post('/medical-validation/governance/detect-phi')
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(201);
      expect(medicalValidationService.detectPhi).toHaveBeenCalled();
    });
  });
});
