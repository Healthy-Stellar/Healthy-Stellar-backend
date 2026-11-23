import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';

import { LaboratoryModule } from '../../src/laboratory/laboratory.module';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../src/auth/guards/roles.guard';
import { CriticalValuesService } from '../../src/laboratory/services/critical-values.service';

describe('CriticalValuesController (e2e) - authentication regression', () => {
  let app: INestApplication;

  const mockCriticalValuesService = {
    createDefinition: jest.fn(),
    updateDefinition: jest.fn(),
    deactivateDefinition: jest.fn(),
    listDefinitions: jest.fn(),
    listUnacknowledged: jest.fn(),
    acknowledge: jest.fn(),
  };

  // Simulated authenticated user injected by the mocked JwtAuthGuard.
  let currentUser: any = null;

  const mockJwtAuthGuard = {
    canActivate: (context: any) => {
      const req = context.switchToHttp().getRequest();
      if (!currentUser) {
        return false;
      }
      req.user = currentUser;
      return true;
    },
  };

  const mockRolesGuard = {
    canActivate: (context: any) => {
      const req = context.switchToHttp().getRequest();
      const requiredRoles: string[] =
        Reflect.getMetadata('roles', context.getHandler()) ||
        Reflect.getMetadata('roles', context.getClass()) ||
        [];
      if (!requiredRoles.length) {
        return true;
      }
      const userRoles: string[] = req.user?.roles || [];
      return requiredRoles.some((role) => userRoles.includes(role));
    },
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [LaboratoryModule],
    })
      .overrideProvider(CriticalValuesService)
      .useValue(mockCriticalValuesService)
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtAuthGuard)
      .overrideGuard(RolesGuard)
      .useValue(mockRolesGuard)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    currentUser = null;
  });

  const definitionPayload = {
    testCode: 'K',
    testName: 'Potassium',
    criticalLow: 2.5,
    criticalHigh: 6.5,
    unit: 'mmol/L',
  };

  describe('anonymous access (no Authorization header)', () => {
    it('POST /laboratory/critical-values/definitions returns 401', async () => {
      await request(app.getHttpServer())
        .post('/laboratory/critical-values/definitions')
        .send(definitionPayload)
        .expect(401);

      expect(mockCriticalValuesService.createDefinition).not.toHaveBeenCalled();
    });

    it('PUT /laboratory/critical-values/definitions/:id returns 401', async () => {
      await request(app.getHttpServer())
        .put('/laboratory/critical-values/definitions/def-1')
        .send({ criticalHigh: 99 })
        .expect(401);

      expect(mockCriticalValuesService.updateDefinition).not.toHaveBeenCalled();
    });

    it('DELETE /laboratory/critical-values/definitions/:id returns 401', async () => {
      await request(app.getHttpServer())
        .delete('/laboratory/critical-values/definitions/def-1')
        .expect(401);

      expect(
        mockCriticalValuesService.deactivateDefinition,
      ).not.toHaveBeenCalled();
    });

    it('GET /laboratory/critical-values/unacknowledged returns 401', async () => {
      await request(app.getHttpServer())
        .get('/laboratory/critical-values/unacknowledged')
        .expect(401);

      expect(mockCriticalValuesService.listUnacknowledged).not.toHaveBeenCalled();
    });

    it('POST /laboratory/critical-values/:id/acknowledge returns 401', async () => {
      await request(app.getHttpServer())
        .post('/laboratory/critical-values/alert-1/acknowledge')
        .send({})
        .expect(401);

      expect(mockCriticalValuesService.acknowledge).not.toHaveBeenCalled();
    });
  });

  describe('authenticated non-admin user', () => {
    beforeEach(() => {
      currentUser = {
        id: 'user-nurse-1',
        email: 'nurse@example.com',
        roles: ['nurse'],
      };
    });

    it('POST /laboratory/critical-values/definitions returns 403', async () => {
      await request(app.getHttpServer())
        .post('/laboratory/critical-values/definitions')
        .send(definitionPayload)
        .expect(403);

      expect(mockCriticalValuesService.createDefinition).not.toHaveBeenCalled();
    });

    it('PUT /laboratory/critical-values/definitions/:id returns 403', async () => {
      await request(app.getHttpServer())
        .put('/laboratory/critical-values/definitions/def-1')
        .send({ criticalHigh: 99 })
        .expect(403);

      expect(mockCriticalValuesService.updateDefinition).not.toHaveBeenCalled();
    });

    it('DELETE /laboratory/critical-values/definitions/:id returns 403', async () => {
      await request(app.getHttpServer())
        .delete('/laboratory/critical-values/definitions/def-1')
        .expect(403);

      expect(
        mockCriticalValuesService.deactivateDefinition,
      ).not.toHaveBeenCalled();
    });
  });

  describe('acknowledge records the authenticated user', () => {
    it('passes the authenticated user id to the service instead of "system"', async () => {
      currentUser = {
        id: 'user-doctor-42',
        email: 'doctor@example.com',
        roles: ['doctor'],
      };

      mockCriticalValuesService.acknowledge.mockResolvedValue({
        id: 'alert-1',
        acknowledgedBy: 'user-doctor-42',
      });

      await request(app.getHttpServer())
        .post('/laboratory/critical-values/alert-1/acknowledge')
        .send({})
        .expect(201);

      expect(mockCriticalValuesService.acknowledge).toHaveBeenCalledTimes(1);

      const callArgs = mockCriticalValuesService.acknowledge.mock.calls[0];
      const serializedArgs = JSON.stringify(callArgs);

      expect(serializedArgs).toContain('user-doctor-42');
      expect(serializedArgs).not.toContain('system');
    });
  });
});