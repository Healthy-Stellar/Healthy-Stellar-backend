import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import * as request from 'supertest';

import { AccessRequestService } from '../services/access-request.service';
import { AccessRequestController } from '../controllers/access-request.controller';
import { AccessRequest, AccessRequestStatus } from '../entities/access-request.entity';
import { AccessGrant, AccessLevel, GrantStatus } from '../entities/access-grant.entity';
import { SorobanQueueService } from '../services/soroban-queue.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { UserRole } from '../../auth/entities/user.entity';

// ── Auth guard stubs ──────────────────────────────────────────────────────────

const PROVIDER_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const PATIENT_ID  = 'bbbbbbbb-0000-0000-0000-000000000002';

function makeJwtGuard(userId: string, role: UserRole) {
  return {
    canActivate: (ctx: any) => {
      ctx.switchToHttp().getRequest().user = { userId, role };
      return true;
    },
  };
}

const mockSoroban = {
  dispatchGrant: jest.fn().mockResolvedValue('0xmock-soroban-hash'),
};

const mockNotifications = {
  sendPatientEmailNotification: jest.fn().mockResolvedValue(undefined),
  emitAccessGranted: jest.fn(),
  emitAccessRevoked: jest.fn(),
};

// ── Helpers ───────────────────────────────────────────────────────────────────

async function buildApp(userId: string, role: UserRole): Promise<INestApplication> {
  const module: TestingModule = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true }),
      TypeOrmModule.forRoot({
        type: 'sqlite',
        database: ':memory:',
        entities: [AccessRequest, AccessGrant],
        synchronize: true,
        dropSchema: true,
      }),
      TypeOrmModule.forFeature([AccessRequest, AccessGrant]),
    ],
    controllers: [AccessRequestController],
    providers: [
      AccessRequestService,
      { provide: SorobanQueueService, useValue: mockSoroban },
      { provide: NotificationsService, useValue: mockNotifications },
    ],
  })
    .overrideGuard(JwtAuthGuard)
    .useValue(makeJwtGuard(userId, role))
    .overrideGuard(RolesGuard)
    .useValue({ canActivate: () => true })
    .compile();

  const app = module.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  await app.init();
  return app;
}

// ══════════════════════════════════════════════════════════════════════════════
describe('Access Request Workflow (integration)', () => {
  let providerApp: INestApplication;
  let patientApp: INestApplication;
  let createdRequestId: string;

  beforeAll(async () => {
    // Two separate app instances sharing the same in-memory DB is not possible
    // with SQLite :memory:, so we use a single app and swap the user context
    // per test via the guard override.
    providerApp = await buildApp(PROVIDER_ID, UserRole.PHYSICIAN);
    patientApp  = await buildApp(PATIENT_ID, UserRole.PATIENT);
  });

  afterAll(async () => {
    await providerApp.close();
    await patientApp.close();
  });

  afterEach(() => jest.clearAllMocks());

  // ── POST /access/request ────────────────────────────────────────────────────
  describe('POST /access/request', () => {
    it('201 — provider submits a valid request', async () => {
      const res = await request(providerApp.getHttpServer())
        .post('/access/request')
        .send({
          patientAddress: PATIENT_ID,
          reason: 'Reviewing chronic condition management plan for patient',
        })
        .expect(201);

      expect(res.body.status).toBe(AccessRequestStatus.PENDING);
      expect(res.body.providerAddress).toBe(PROVIDER_ID);
      expect(res.body.patientAddress).toBe(PATIENT_ID);
      expect(new Date(res.body.expiresAt).getTime()).toBeGreaterThan(Date.now());

      createdRequestId = res.body.id;
    });

    it('notifies the patient on submission', async () => {
      expect(mockNotifications.sendPatientEmailNotification).toHaveBeenCalledWith(
        PATIENT_ID,
        expect.stringContaining('access request'),
        expect.any(String),
      );
    });

    it('409 — duplicate pending request from same provider', async () => {
      await request(providerApp.getHttpServer())
        .post('/access/request')
        .send({
          patientAddress: PATIENT_ID,
          reason: 'Reviewing chronic condition management plan for patient',
        })
        .expect(409);
    });

    it('400 — reason too short (< 20 chars)', async () => {
      await request(providerApp.getHttpServer())
        .post('/access/request')
        .send({ patientAddress: PATIENT_ID, reason: 'Too short' })
        .expect(400);
    });

    it('400 — missing patientAddress', async () => {
      await request(providerApp.getHttpServer())
        .post('/access/request')
        .send({ reason: 'Reviewing chronic condition management plan for patient' })
        .expect(400);
    });
  });

  // ── GET /access/requests ────────────────────────────────────────────────────
  describe('GET /access/requests', () => {
    it('200 — patient sees the pending request', async () => {
      const res = await request(patientApp.getHttpServer())
        .get('/access/requests')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body[0].status).toBe(AccessRequestStatus.PENDING);
    });
  });

  // ── PATCH /access/requests/:id/approve ─────────────────────────────────────
  describe('PATCH /access/requests/:id/approve', () => {
    it('200 — patient approves; grant created and Soroban dispatched', async () => {
      const res = await request(patientApp.getHttpServer())
        .patch(`/access/requests/${createdRequestId}/approve`)
        .expect(200);

      expect(res.body.request.status).toBe(AccessRequestStatus.APPROVED);
      expect(res.body.request.sorobanTxHash).toBe('0xmock-soroban-hash');
      expect(res.body.grant.granteeId).toBe(PROVIDER_ID);
      expect(res.body.grant.accessLevel).toBe(AccessLevel.READ);
      expect(res.body.grant.status).toBe(GrantStatus.ACTIVE);
      expect(mockSoroban.dispatchGrant).toHaveBeenCalledTimes(1);
    });

    it('409 — cannot approve an already-approved request', async () => {
      await request(patientApp.getHttpServer())
        .patch(`/access/requests/${createdRequestId}/approve`)
        .expect(409);
    });
  });

  // ── PATCH /access/requests/:id/deny ────────────────────────────────────────
  describe('PATCH /access/requests/:id/deny — separate request', () => {
    let denyRequestId: string;

    beforeAll(async () => {
      // Submit a fresh request to deny
      const res = await request(providerApp.getHttpServer())
        .post('/access/request')
        .send({
          patientAddress: PATIENT_ID,
          reason: 'Second request for denial workflow integration test',
        });
      denyRequestId = res.body.id;
    });

    it('200 — patient denies the request', async () => {
      const res = await request(patientApp.getHttpServer())
        .patch(`/access/requests/${denyRequestId}/deny`)
        .expect(200);

      expect(res.body.status).toBe(AccessRequestStatus.DENIED);
      expect(res.body.respondedAt).not.toBeNull();
    });

    it('Soroban is NOT called on denial', () => {
      expect(mockSoroban.dispatchGrant).not.toHaveBeenCalled();
    });

    it('409 — cannot deny an already-denied request', async () => {
      await request(patientApp.getHttpServer())
        .patch(`/access/requests/${denyRequestId}/deny`)
        .expect(409);
    });

    it('404 — non-existent request ID', async () => {
      await request(patientApp.getHttpServer())
        .patch('/access/requests/00000000-0000-0000-0000-000000000000/deny')
        .expect(404);
    });
  });

  // ── Expiry ──────────────────────────────────────────────────────────────────
  describe('expireStaleRequests', () => {
    it('bulk-expires PENDING requests past their TTL', async () => {
      const service = providerApp.get(AccessRequestService);

      // Manually submit a request then back-date its expiresAt via the repo
      const submitRes = await request(providerApp.getHttpServer())
        .post('/access/request')
        .send({
          patientAddress: PATIENT_ID,
          reason: 'Third request to test expiry in integration suite',
        });

      // Directly update the DB row to simulate TTL elapsed
      const repo = (service as any).requestRepo;
      await repo.update(submitRes.body.id, { expiresAt: new Date(Date.now() - 1000) });

      const expired = await service.expireStaleRequests();
      expect(expired).toBeGreaterThanOrEqual(1);

      const updated = await repo.findOne({ where: { id: submitRes.body.id } });
      expect(updated.status).toBe(AccessRequestStatus.EXPIRED);
    });
  });
});
