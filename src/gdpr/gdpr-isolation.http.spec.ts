/**
 * #1327 — GDPR handlers must use req.user.userId (JwtPayload has no `id`).
 * With `id`, TypeORM dropped the undefined key and returned every user's rows.
 */
jest.mock('./processors/gdpr.processor', () => ({
  GdprProcessor: { getExportFilePath: jest.fn(), deleteExportFile: jest.fn() },
}));

import { BadRequestException, INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as request from 'supertest';
import { GdprController } from './controllers/gdpr.controller';
import { GdprService } from './services/gdpr.service';
import { GdprRequest, GdprRequestStatus, GdprRequestType } from './entities/gdpr-request.entity';
import { ThrottlerBehindProxyGuard } from '../common/throttler/throttler-behind-proxy.guard';
import { UserRole } from '../auth/entities/user.entity';
import { InMemoryRepository, bearer, createJwtHttpHarness } from '../../test/utils/jwt-http-harness';

const USER_A = { userId: 'user-a', role: UserRole.PATIENT };
const USER_B = { userId: 'user-b', role: UserRole.PATIENT };

describe('GDPR request isolation (HTTP, #1327)', () => {
  let app: INestApplication;
  let requests: InMemoryRepository<any>;
  let queue: { add: jest.Mock };
  let service: GdprService;

  beforeEach(async () => {
    requests = new InMemoryRepository([
      { id: 'req-a', userId: USER_A.userId, type: GdprRequestType.EXPORT, status: GdprRequestStatus.COMPLETED, createdAt: new Date(1) },
      { id: 'req-b', userId: USER_B.userId, type: GdprRequestType.ERASURE, status: GdprRequestStatus.PENDING, createdAt: new Date(2) },
    ]);
    queue = { add: jest.fn().mockResolvedValue(undefined) };
    const deletionRegistry = { previewForUser: jest.fn(async (id: string) => [{ module: 'm', userId: id }]) };
    service = new GdprService(requests as any, new InMemoryRepository() as any, queue as any, deletionRegistry as any);

    app = await createJwtHttpHarness({
      controllers: [GdprController],
      providers: [
        { provide: GdprService, useValue: service },
        { provide: getRepositoryToken(GdprRequest), useValue: requests },
      ],
      allowGuards: [ThrottlerBehindProxyGuard],
    });
  });

  afterEach(async () => {
    await app?.close();
  });

  it("user A's GET /gdpr/requests never contains user B's requests", async () => {
    const res = await request(app.getHttpServer())
      .get('/gdpr/requests')
      .set('Authorization', bearer(USER_A))
      .expect(200);
    expect(res.body.map((r: any) => r.id)).toEqual(['req-a']);
    expect(res.body.every((r: any) => r.userId === USER_A.userId)).toBe(true);
  });

  it('export requests are created for the authenticated user (not NULL)', async () => {
    const res = await request(app.getHttpServer())
      .post('/gdpr/data-export-request')
      .set('Authorization', bearer(USER_B))
      .expect(202);
    expect(res.body.userId).toBe(USER_B.userId);
    expect(queue.add).toHaveBeenCalledWith('export-data', expect.objectContaining({ userId: USER_B.userId }));
  });

  it('erasure preview runs for the authenticated user', async () => {
    const res = await request(app.getHttpServer())
      .get('/gdpr/erasure-request/preview')
      .set('Authorization', bearer(USER_A))
      .expect(200);
    expect(res.body).toEqual([{ module: 'm', userId: USER_A.userId }]);
  });

  it("downloading another user's export is forbidden", async () => {
    await request(app.getHttpServer())
      .get('/gdpr/export-files/req-b/dsar-bundle.json?expires=1&sig=x')
      .set('Authorization', bearer(USER_A))
      .expect(403);
  });

  it('rejects anonymous callers with 401', async () => {
    await request(app.getHttpServer()).get('/gdpr/requests').expect(401);
  });

  describe('GdprService fails closed on a missing userId', () => {
    it.each([
      ['getRequestsByUser', (s: GdprService) => s.getRequestsByUser(undefined as any)],
      ['createExportRequest', (s: GdprService) => s.createExportRequest(undefined as any)],
      ['createErasureRequest', (s: GdprService) => s.createErasureRequest(undefined as any)],
      ['previewErasure', (s: GdprService) => s.previewErasure(undefined as any)],
    ])('%s throws instead of querying with undefined', async (_name, call) => {
      await expect(call(service)).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
