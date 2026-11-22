// The services are replaced by mocks below. Stubbing their modules (and the
// DTO/entity modules the controllers import) keeps Jest from loading the
// stale compiled `.js` twins committed next to some of these sources; this
// suite tests the guards, not validation.
jest.mock('../../src/performance/database-optimization/slow-query.subscriber', () => ({
  SlowQuerySubscriber: class SlowQuerySubscriber {},
}));
jest.mock('../../src/laboratory/services/order-set-templates.service', () => ({
  OrderSetTemplatesService: class OrderSetTemplatesService {},
}));
jest.mock('../../src/laboratory/dto/create-order-set-template.dto', () => ({
  CreateOrderSetTemplateDto: class CreateOrderSetTemplateDto {},
  UpdateOrderSetTemplateDto: class UpdateOrderSetTemplateDto {},
}));
jest.mock('../../src/laboratory/dto/order-from-template.dto', () => ({
  OrderFromTemplateDto: class OrderFromTemplateDto {},
}));
jest.mock('../../src/medical-records/services/clinical-templates.service', () => ({
  ClinicalTemplatesService: class ClinicalTemplatesService {},
}));
jest.mock('../../src/medical-records/dto/create-clinical-template.dto', () => ({
  CreateClinicalTemplateDto: class CreateClinicalTemplateDto {},
}));
jest.mock('../../src/medical-records/entities/clinical-note-template.entity', () => ({
  TemplateCategory: {},
}));

import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';

import { PerformanceController } from '../../src/performance/database-optimization/performance.controller';
import { SlowQuerySubscriber } from '../../src/performance/database-optimization/slow-query.subscriber';
import { OrderSetTemplatesController } from '../../src/laboratory/controllers/order-set-templates.controller';
import { OrderSetTemplatesService } from '../../src/laboratory/services/order-set-templates.service';
import { ClinicalTemplatesController } from '../../src/medical-records/controllers/clinical-templates.controller';
import { ClinicalTemplatesService } from '../../src/medical-records/services/clinical-templates.service';
import { AuthTokenService } from '../../src/auth/services/auth-token.service';
import { SessionManagementService } from '../../src/auth/services/session-management.service';
import { UserRole } from '../../src/auth/entities/user.entity';

/**
 * Regression coverage for #1329 (re-opened #1029, #1164, #1165): every route on
 * these controllers must reject anonymous callers, enforce roles, and take the
 * actor id from the authenticated user rather than a placeholder.
 */
describe('Previously unguarded controllers (e2e) — #1329', () => {
  let app: INestApplication;

  const TEMPLATE_ID = '5d1f4a8e-1b2c-4d3e-8f90-a1b2c3d4e5f6';
  const ENCOUNTER_ID = '6e2a5b9f-2c3d-4e5f-9a01-b2c3d4e5f6a7';

  const users: Record<string, { userId: string; role: UserRole }> = {
    'admin-token': { userId: 'admin-1', role: UserRole.ADMIN },
    'physician-token': { userId: 'physician-1', role: UserRole.PHYSICIAN },
    'nurse-token': { userId: 'nurse-1', role: UserRole.NURSE },
    'patient-token': { userId: 'patient-1', role: UserRole.PATIENT },
  };

  const authTokenServiceMock = {
    verifyAccessToken: jest.fn((token: string) => {
      const user = users[token];
      return user
        ? { ...user, email: `${user.userId}@test`, mfaVerified: true, sessionId: `session-${user.userId}`, organizationId: 'org-1' }
        : null;
    }),
  };
  const sessionManagementServiceMock = {
    isSessionValid: jest.fn(async () => true),
    updateSessionActivity: jest.fn(async () => undefined),
  };

  const slowQueries = { getSlowQueries: jest.fn(() => [{ query: 'SELECT * FROM patients WHERE ssn = $1' }]) };
  const orderSetService = {
    findAll: jest.fn(async () => []),
    findOne: jest.fn(async () => ({ id: TEMPLATE_ID })),
    create: jest.fn(async () => ({ id: TEMPLATE_ID })),
    update: jest.fn(async () => ({ id: TEMPLATE_ID })),
    orderFromTemplate: jest.fn(async () => ({ id: 'order-1' })),
  };
  const clinicalTemplatesService = {
    create: jest.fn(async () => ({ id: TEMPLATE_ID })),
    findAll: jest.fn(async () => []),
    findOne: jest.fn(async () => ({ id: TEMPLATE_ID })),
    update: jest.fn(async () => ({ id: TEMPLATE_ID })),
    delete: jest.fn(async () => undefined),
  };

  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
  const http = () => request(app.getHttpServer());

  /** Every route registered on the three controllers. */
  const routes: Array<{ method: 'get' | 'post' | 'patch' | 'put' | 'delete'; path: string }> = [
    { method: 'get', path: '/performance/slow-queries' },
    { method: 'get', path: '/laboratory/order-set-templates' },
    { method: 'get', path: `/laboratory/order-set-templates/${TEMPLATE_ID}` },
    { method: 'post', path: '/laboratory/order-set-templates' },
    { method: 'patch', path: `/laboratory/order-set-templates/${TEMPLATE_ID}` },
    { method: 'post', path: '/laboratory/order-set-templates/order' },
    { method: 'get', path: '/clinical-templates' },
    { method: 'get', path: `/clinical-templates/${TEMPLATE_ID}` },
    { method: 'post', path: '/clinical-templates' },
    { method: 'put', path: `/clinical-templates/${TEMPLATE_ID}` },
    { method: 'delete', path: `/clinical-templates/${TEMPLATE_ID}` },
  ];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [PerformanceController, OrderSetTemplatesController, ClinicalTemplatesController],
      providers: [
        { provide: SlowQuerySubscriber, useValue: slowQueries },
        { provide: OrderSetTemplatesService, useValue: orderSetService },
        { provide: ClinicalTemplatesService, useValue: clinicalTemplatesService },
        { provide: AuthTokenService, useValue: authTokenServiceMock },
        { provide: SessionManagementService, useValue: sessionManagementServiceMock },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  beforeEach(() => jest.clearAllMocks());

  afterAll(async () => {
    if (app) await app.close();
  });

  describe('anonymous callers', () => {
    it.each(routes)('$method $path → 401', async ({ method, path }) => {
      await http()[method](path).send({}).expect(401);
    });

    it('never reach a service', async () => {
      for (const { method, path } of routes) {
        await http()[method](path).send({});
      }
      expect(slowQueries.getSlowQueries).not.toHaveBeenCalled();
      for (const svc of [orderSetService, clinicalTemplatesService]) {
        for (const fn of Object.values(svc)) expect(fn).not.toHaveBeenCalled();
      }
    });

    it('are rejected with an invalid token too', async () => {
      await http().get('/performance/slow-queries').set(bearer('forged')).expect(401);
    });
  });

  describe('roles', () => {
    it('slow queries (unredacted SQL) are admin-only', async () => {
      await http().get('/performance/slow-queries').set(bearer('physician-token')).expect(403);
      await http().get('/performance/slow-queries').set(bearer('admin-token')).expect(200);
    });

    it('patients cannot read clinical or order-set templates', async () => {
      await http().get('/clinical-templates').set(bearer('patient-token')).expect(403);
      await http().get('/laboratory/order-set-templates').set(bearer('patient-token')).expect(403);
    });

    it('only admins manage order-set templates', async () => {
      await http().post('/laboratory/order-set-templates').set(bearer('physician-token')).send({}).expect(403);
      await http()
        .patch(`/laboratory/order-set-templates/${TEMPLATE_ID}`)
        .set(bearer('nurse-token'))
        .send({})
        .expect(403);
    });

    it('nurses cannot place lab orders from a template', async () => {
      await http()
        .post('/laboratory/order-set-templates/order')
        .set(bearer('nurse-token'))
        .send({ templateId: TEMPLATE_ID, encounterId: ENCOUNTER_ID })
        .expect(403);
      expect(orderSetService.orderFromTemplate).not.toHaveBeenCalled();
    });

    it('only admins delete clinical templates', async () => {
      await http().delete(`/clinical-templates/${TEMPLATE_ID}`).set(bearer('physician-token')).expect(403);
      await http().delete(`/clinical-templates/${TEMPLATE_ID}`).set(bearer('admin-token')).expect(200);
    });
  });

  describe('actor ids come from the authenticated user', () => {
    it('order-from-template records the physician, not "system"', async () => {
      await http()
        .post('/laboratory/order-set-templates/order')
        .set(bearer('physician-token'))
        .send({ templateId: TEMPLATE_ID, encounterId: ENCOUNTER_ID })
        .expect(201);

      expect(orderSetService.orderFromTemplate).toHaveBeenCalledWith(expect.anything(), 'physician-1');
    });

    it('creating an order-set template records the admin, not "system"', async () => {
      await http().post('/laboratory/order-set-templates').set(bearer('admin-token')).send({}).expect(201);

      expect(orderSetService.create).toHaveBeenCalledWith(expect.anything(), 'admin-1');
    });

    it('creating a clinical template records the author, not the nil UUID', async () => {
      await http().post('/clinical-templates').set(bearer('physician-token')).send({}).expect(201);

      expect(clinicalTemplatesService.create).toHaveBeenCalledWith(expect.anything(), 'physician-1');
    });
  });
});
