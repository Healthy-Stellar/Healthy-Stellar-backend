jest.mock('../../src/auth/guards/jwt-auth.guard', () => ({
  JwtAuthGuard: class JwtAuthGuard {},
}));

import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as request from 'supertest';
import { randomUUID } from 'crypto';
import { BedOccupancyController } from '../../src/bed-occupancy/bed-occupancy.controller';
import { BedOccupancyService } from '../../src/bed-occupancy/bed-occupancy.service';
import { BedStatus } from '../../src/bed-occupancy/bed-status.enum';
import { Bed } from '../../src/bed-occupancy/entities/bed.entity';
import { Room } from '../../src/bed-occupancy/entities/room.entity';
import { Ward } from '../../src/bed-occupancy/entities/ward.entity';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../src/auth/guards/roles.guard';
import { UserRole } from '../../src/auth/entities/user.entity';

const TENANT_A = '11111111-1111-4111-8111-111111111111';
const TENANT_B = '22222222-2222-4222-8222-222222222222';

const WARD_A_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const WARD_B_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
const ROOM_A_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
const ROOM_B_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2';
const BED_A_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3';
const BED_B_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3';
const PATIENT_A_ID = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1';
const PATIENT_B_ID = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1';

interface TokenUser {
  userId: string;
  role: UserRole;
  organizationId?: string;
}

const TOKEN_USERS: Record<string, TokenUser> = {
  'admin-a': { userId: 'admin-a', role: UserRole.ADMIN, organizationId: TENANT_A },
  'super-a': { userId: 'super-a', role: UserRole.SUPER_ADMIN, organizationId: TENANT_A },
  'nurse-a': { userId: 'nurse-a', role: UserRole.NURSE, organizationId: TENANT_A },
  'physician-a': { userId: 'physician-a', role: UserRole.PHYSICIAN, organizationId: TENANT_A },
  'surgeon-a': { userId: 'surgeon-a', role: UserRole.SURGEON, organizationId: TENANT_A },
  'records-a': { userId: 'records-a', role: UserRole.MEDICAL_RECORDS, organizationId: TENANT_A },
  'patient-a': { userId: 'patient-a', role: UserRole.PATIENT, organizationId: TENANT_A },
  'billing-a': { userId: 'billing-a', role: UserRole.BILLING_STAFF, organizationId: TENANT_A },
  'tenantless-admin': { userId: 'tenantless', role: UserRole.ADMIN },
  'admin-b': { userId: 'admin-b', role: UserRole.ADMIN, organizationId: TENANT_B },
  'nurse-b': { userId: 'nurse-b', role: UserRole.NURSE, organizationId: TENANT_B },
};

class TokenAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const auth = req.headers.authorization as string | undefined;
    if (!auth?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Authentication token is missing');
    }
    const token = auth.slice('Bearer '.length);
    const user = TOKEN_USERS[token];
    if (!user) {
      throw new UnauthorizedException('Invalid or expired authentication token');
    }
    req.user = { ...user };
    return true;
  }
}

function matchesWhere(row: any, where: any): boolean {
  if (!where) return true;
  if (Array.isArray(where)) return where.some((w) => matchesWhere(row, w));
  return Object.entries(where).every(([key, expected]) => {
    if (expected === undefined) return true;
    const actual = row?.[key];
    if (expected && typeof expected === 'object' && !(expected instanceof Date)) {
      const op = expected as any;
      if (op._type === 'in') return Array.isArray(op._value) && op._value.includes(actual);
    }
    return actual === expected;
  });
}

class InMemoryRepo<T extends { id?: string }> {
  rows: T[] = [];

  constructor(seed: T[] = []) {
    this.rows = seed.map((r) => ({ ...r }));
  }

  create(data: Partial<T>): T {
    return { ...(data as T) };
  }

  async save(entity: T): Promise<T> {
    if (!entity.id) (entity as any).id = randomUUID();
    const idx = this.rows.findIndex((r) => r.id === entity.id);
    if (idx >= 0) this.rows[idx] = { ...this.rows[idx], ...entity };
    else this.rows.push({ ...entity });
    return { ...entity };
  }

  async find(opts: { where?: any } = {}): Promise<T[]> {
    return this.rows.filter((r) => matchesWhere(r, opts.where)).map((r) => ({ ...r }));
  }

  async findOne(opts: { where?: any } = {}): Promise<T | null> {
    const found = this.rows.find((r) => matchesWhere(r, opts.where));
    return found ? { ...found } : null;
  }
}

class InMemoryBedRepo extends InMemoryRepo<Bed> {
  roomsRepo: InMemoryRepo<Room>;

  constructor(seed: Bed[], roomsRepo: InMemoryRepo<Room>) {
    super(seed);
    this.roomsRepo = roomsRepo;
  }

  manager = {
    transaction: async <R>(cb: (em: any) => Promise<R>): Promise<R> => {
      const em = {
        connection: { options: { type: 'sqlite' } },
        query: jest.fn(),
        createQueryBuilder: (_entity: any, _alias: string) => this.createQueryBuilder('bed'),
        save: async (_entity: any, record: Bed) => this.save(record),
      };
      return cb(em);
    },
  };

  createQueryBuilder(_alias: string) {
    const filters: Array<{ clause: string; params: Record<string, any> }> = [];
    let joinParams: Record<string, any> | null = null;
    const self = this;

    const qb: any = {
      setLock() {
        return qb;
      },
      select() {
        return qb;
      },
      addSelect() {
        return qb;
      },
      innerJoin(_entity: any, _joinAlias: string, _condition: string, params: Record<string, any>) {
        joinParams = params;
        return qb;
      },
      where(clause: string, params: Record<string, any> = {}) {
        filters.push({ clause, params });
        return qb;
      },
      andWhere(clause: string, params: Record<string, any> = {}) {
        filters.push({ clause, params });
        return qb;
      },
      groupBy() {
        return qb;
      },
      async getOne() {
        const match = self.rows.find((bed) => self.matchesFilters(bed, filters));
        return match ? { ...match } : null;
      },
      async getRawMany() {
        const filtered = self.rows.filter((bed) => {
          if (!self.matchesFilters(bed, filters)) return false;
          if (joinParams?.wardId) {
            const room = self.roomsRepo.rows.find(
              (r) =>
                r.id === bed.roomId &&
                r.wardId === joinParams!.wardId &&
                r.tenantId === joinParams!.tenantId,
            );
            if (!room) return false;
          }
          return true;
        });
        const counts = new Map<BedStatus, number>();
        for (const bed of filtered) {
          counts.set(bed.status, (counts.get(bed.status) ?? 0) + 1);
        }
        return Array.from(counts.entries()).map(([status, count]) => ({
          status,
          count: String(count),
        }));
      },
    };
    return qb;
  }

  private matchesFilters(
    bed: Bed,
    filters: Array<{ clause: string; params: Record<string, any> }>,
  ): boolean {
    return filters.every(({ clause, params }) => {
      if (clause === 'bed.isActive = true') return bed.isActive === true;
      if (clause.includes('bed.id = :id')) return bed.id === params.id;
      if (clause.includes('bed.tenantId = :tenantId')) return bed.tenantId === params.tenantId;
      if (clause.includes('bed.patientId = :patientId')) return bed.patientId === params.patientId;
      if (clause.includes('bed.status = :status')) return bed.status === params.status;
      if (clause.includes('bed.id != :bedId')) return bed.id !== params.bedId;
      return true;
    });
  }
}

describe('BedOccupancyController authorization & tenant isolation (e2e)', () => {
  let app: INestApplication;
  let wardRepo: InMemoryRepo<Ward>;
  let roomRepo: InMemoryRepo<Room>;
  let bedRepo: InMemoryBedRepo;

  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  function seedData() {
    wardRepo.rows = [
      { id: WARD_A_ID, tenantId: TENANT_A, name: 'Cardiology A', wardManagerId: null as any, isActive: true },
      { id: WARD_B_ID, tenantId: TENANT_B, name: 'Cardiology B', wardManagerId: null as any, isActive: true },
    ];
    roomRepo.rows = [
      { id: ROOM_A_ID, tenantId: TENANT_A, wardId: WARD_A_ID, roomNumber: 'A-101', isActive: true },
      { id: ROOM_B_ID, tenantId: TENANT_B, wardId: WARD_B_ID, roomNumber: 'B-201', isActive: true },
    ];
    bedRepo.rows = [
      {
        id: BED_A_ID,
        tenantId: TENANT_A,
        bedNumber: 'A1',
        status: BedStatus.AVAILABLE,
        roomId: ROOM_A_ID,
        patientId: null as any,
        assignedAt: null as any,
        features: [],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: BED_B_ID,
        tenantId: TENANT_B,
        bedNumber: 'B1',
        status: BedStatus.AVAILABLE,
        roomId: ROOM_B_ID,
        patientId: null as any,
        assignedAt: null as any,
        features: [],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
  }

  beforeAll(async () => {
    wardRepo = new InMemoryRepo<Ward>();
    roomRepo = new InMemoryRepo<Room>();
    bedRepo = new InMemoryBedRepo([], roomRepo);

    const moduleRef = await Test.createTestingModule({
      controllers: [BedOccupancyController],
      providers: [
        BedOccupancyService,
        RolesGuard,
        { provide: getRepositoryToken(Ward), useValue: wardRepo },
        { provide: getRepositoryToken(Room), useValue: roomRepo },
        { provide: getRepositoryToken(Bed), useValue: bedRepo },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(new TokenAuthGuard())
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  });

  beforeEach(() => {
    seedData();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  describe('authentication', () => {
    it.each([
      ['post', '/bed-occupancy/wards'],
      ['get', '/bed-occupancy/wards'],
      ['post', '/bed-occupancy/rooms'],
      ['get', `/bed-occupancy/wards/${WARD_A_ID}/rooms`],
      ['post', '/bed-occupancy/beds'],
      ['get', '/bed-occupancy/beds'],
      ['get', `/bed-occupancy/beds/${BED_A_ID}`],
      ['post', '/bed-occupancy/beds/assign'],
      ['patch', `/bed-occupancy/beds/${BED_A_ID}/release`],
      ['patch', `/bed-occupancy/beds/${BED_A_ID}/status`],
      ['get', '/bed-occupancy/summary'],
    ])('%s %s rejects anonymous callers with 401', async (method, url) => {
      await (request(app.getHttpServer()) as any)[method](url).expect(401);
    });

    it('rejects authenticated caller without tenant context with 403', async () => {
      await request(app.getHttpServer())
        .get('/bed-occupancy/wards')
        .set(bearer('tenantless-admin'))
        .expect(403);
    });
  });

  describe('RBAC — PATIENT and unauthorized roles', () => {
    it.each([
      ['post', '/bed-occupancy/wards', { name: 'Injected Ward' }],
      ['get', '/bed-occupancy/wards', undefined],
      ['post', '/bed-occupancy/rooms', { wardId: WARD_A_ID, roomNumber: '999' }],
      ['get', `/bed-occupancy/wards/${WARD_A_ID}/rooms`, undefined],
      ['post', '/bed-occupancy/beds', { bedNumber: '9Z', roomId: ROOM_A_ID }],
      ['get', '/bed-occupancy/beds', undefined],
      ['get', `/bed-occupancy/beds/${BED_A_ID}`, undefined],
      ['post', '/bed-occupancy/beds/assign', { bedId: BED_A_ID, patientId: PATIENT_A_ID }],
      ['patch', `/bed-occupancy/beds/${BED_A_ID}/release`, undefined],
      ['patch', `/bed-occupancy/beds/${BED_A_ID}/status`, { status: BedStatus.MAINTENANCE }],
      ['get', '/bed-occupancy/summary', undefined],
    ])('PATIENT gets 403 Forbidden on %s %s', async (method, url, body) => {
      const req = (request(app.getHttpServer()) as any)[method](url).set(bearer('patient-a'));
      if (body) req.send(body);
      await req.expect(403);
    });

    it('BILLING_STAFF gets 403 Forbidden on reads and mutations', async () => {
      await request(app.getHttpServer())
        .get('/bed-occupancy/beds')
        .set(bearer('billing-a'))
        .expect(403);
      await request(app.getHttpServer())
        .post('/bed-occupancy/wards')
        .set(bearer('billing-a'))
        .send({ name: 'X' })
        .expect(403);
    });
  });

  describe('RBAC — route-level role separation', () => {
    it('only ADMIN / SUPER_ADMIN can create wards, rooms, and beds', async () => {
      for (const token of ['nurse-a', 'physician-a', 'surgeon-a']) {
        await request(app.getHttpServer())
          .post('/bed-occupancy/wards')
          .set(bearer(token))
          .send({ name: 'Unauthorized Ward' })
          .expect(403);
        await request(app.getHttpServer())
          .post('/bed-occupancy/rooms')
          .set(bearer(token))
          .send({ wardId: WARD_A_ID, roomNumber: '102' })
          .expect(403);
        await request(app.getHttpServer())
          .post('/bed-occupancy/beds')
          .set(bearer(token))
          .send({ bedNumber: 'A2', roomId: ROOM_A_ID })
          .expect(403);
      }

      const wardRes = await request(app.getHttpServer())
        .post('/bed-occupancy/wards')
        .set(bearer('admin-a'))
        .send({ name: 'ICU A' })
        .expect(201);
      expect(wardRes.body.tenantId).toBe(TENANT_A);

      const roomRes = await request(app.getHttpServer())
        .post('/bed-occupancy/rooms')
        .set(bearer('super-a'))
        .send({ wardId: wardRes.body.id, roomNumber: 'ICU-1' })
        .expect(201);
      expect(roomRes.body.tenantId).toBe(TENANT_A);

      const bedRes = await request(app.getHttpServer())
        .post('/bed-occupancy/beds')
        .set(bearer('admin-a'))
        .send({ bedNumber: 'ICU-1A', roomId: roomRes.body.id })
        .expect(201);
      expect(bedRes.body.tenantId).toBe(TENANT_A);
    });

    it('NURSE and ADMIN can assign, update status, and release beds; PHYSICIAN gets 403', async () => {
      await request(app.getHttpServer())
        .post('/bed-occupancy/beds/assign')
        .set(bearer('physician-a'))
        .send({ bedId: BED_A_ID, patientId: PATIENT_A_ID })
        .expect(403);

      const assignRes = await request(app.getHttpServer())
        .post('/bed-occupancy/beds/assign')
        .set(bearer('nurse-a'))
        .send({ bedId: BED_A_ID, patientId: PATIENT_A_ID })
        .expect(201);
      expect(assignRes.body.status).toBe(BedStatus.OCCUPIED);
      expect(assignRes.body.patientId).toBe(PATIENT_A_ID);

      await request(app.getHttpServer())
        .patch(`/bed-occupancy/beds/${BED_A_ID}/release`)
        .set(bearer('physician-a'))
        .expect(403);

      const releaseRes = await request(app.getHttpServer())
        .patch(`/bed-occupancy/beds/${BED_A_ID}/release`)
        .set(bearer('nurse-a'))
        .expect(200);
      expect(releaseRes.body.status).toBe(BedStatus.CLEANING);

      await request(app.getHttpServer())
        .patch(`/bed-occupancy/beds/${BED_A_ID}/status`)
        .set(bearer('physician-a'))
        .send({ status: BedStatus.AVAILABLE })
        .expect(403);

      const statusRes = await request(app.getHttpServer())
        .patch(`/bed-occupancy/beds/${BED_A_ID}/status`)
        .set(bearer('admin-a'))
        .send({ status: BedStatus.AVAILABLE })
        .expect(200);
      expect(statusRes.body.status).toBe(BedStatus.AVAILABLE);
    });

    it('clinical staff (PHYSICIAN, SURGEON, NURSE, MEDICAL_RECORDS) can read beds and summary within own tenant', async () => {
      for (const token of ['physician-a', 'surgeon-a', 'nurse-a', 'records-a']) {
        await request(app.getHttpServer())
          .get('/bed-occupancy/wards')
          .set(bearer(token))
          .expect(200);
        await request(app.getHttpServer())
          .get(`/bed-occupancy/wards/${WARD_A_ID}/rooms`)
          .set(bearer(token))
          .expect(200);
        await request(app.getHttpServer())
          .get('/bed-occupancy/beds')
          .set(bearer(token))
          .expect(200);
        await request(app.getHttpServer())
          .get(`/bed-occupancy/beds/${BED_A_ID}`)
          .set(bearer(token))
          .expect(200);
        await request(app.getHttpServer())
          .get('/bed-occupancy/summary')
          .set(bearer(token))
          .expect(200);
      }
    });
  });

  describe('tenant isolation', () => {
    it('Tenant A reads only see Tenant A wards, beds, and summary', async () => {
      const wardsRes = await request(app.getHttpServer())
        .get('/bed-occupancy/wards')
        .set(bearer('nurse-a'))
        .expect(200);
      expect(wardsRes.body.map((w: Ward) => w.id)).toEqual([WARD_A_ID]);

      const bedsRes = await request(app.getHttpServer())
        .get('/bed-occupancy/beds')
        .set(bearer('nurse-a'))
        .expect(200);
      expect(bedsRes.body.map((b: Bed) => b.id)).toEqual([BED_A_ID]);

      const summaryRes = await request(app.getHttpServer())
        .get('/bed-occupancy/summary')
        .set(bearer('nurse-a'))
        .expect(200);
      expect(summaryRes.body.total).toBe(1);
    });

    it('Tenant A cannot read Tenant B ward rooms, bed by id, or summary by wardId', async () => {
      await request(app.getHttpServer())
        .get(`/bed-occupancy/wards/${WARD_B_ID}/rooms`)
        .set(bearer('nurse-a'))
        .expect(404);

      await request(app.getHttpServer())
        .get(`/bed-occupancy/beds/${BED_B_ID}`)
        .set(bearer('nurse-a'))
        .expect(404);

      await request(app.getHttpServer())
        .get(`/bed-occupancy/beds?wardId=${WARD_B_ID}`)
        .set(bearer('nurse-a'))
        .expect(404);

      await request(app.getHttpServer())
        .get(`/bed-occupancy/beds?roomId=${ROOM_B_ID}`)
        .set(bearer('nurse-a'))
        .expect(404);

      await request(app.getHttpServer())
        .get(`/bed-occupancy/summary?wardId=${WARD_B_ID}`)
        .set(bearer('nurse-a'))
        .expect(404);
    });

    it('Tenant A cannot create rooms/beds under Tenant B wards/rooms or override tenantId in DTO', async () => {
      await request(app.getHttpServer())
        .post('/bed-occupancy/wards')
        .set(bearer('admin-a'))
        .send({ name: 'Spoofed', tenantId: TENANT_B })
        .expect(400);

      await request(app.getHttpServer())
        .post('/bed-occupancy/rooms')
        .set(bearer('admin-a'))
        .send({ wardId: WARD_B_ID, roomNumber: 'X-101' })
        .expect(404);

      await request(app.getHttpServer())
        .post('/bed-occupancy/beds')
        .set(bearer('admin-a'))
        .send({ bedNumber: 'X1', roomId: ROOM_B_ID })
        .expect(404);
    });

    it('Tenant A cannot assign, release, or update status of Tenant B beds', async () => {
      await request(app.getHttpServer())
        .post('/bed-occupancy/beds/assign')
        .set(bearer('nurse-a'))
        .send({ bedId: BED_B_ID, patientId: PATIENT_A_ID })
        .expect(404);

      // Occupy bed B legitimately as Tenant B nurse
      await request(app.getHttpServer())
        .post('/bed-occupancy/beds/assign')
        .set(bearer('nurse-b'))
        .send({ bedId: BED_B_ID, patientId: PATIENT_B_ID })
        .expect(201);

      // Tenant A cannot release Tenant B's occupied bed
      await request(app.getHttpServer())
        .patch(`/bed-occupancy/beds/${BED_B_ID}/release`)
        .set(bearer('nurse-a'))
        .expect(404);

      // Tenant A cannot update Tenant B's bed status
      await request(app.getHttpServer())
        .patch(`/bed-occupancy/beds/${BED_B_ID}/status`)
        .set(bearer('admin-a'))
        .send({ status: BedStatus.MAINTENANCE })
        .expect(404);

      // Verify Tenant B's bed remains occupied by Patient B
      const checkB = await request(app.getHttpServer())
        .get(`/bed-occupancy/beds/${BED_B_ID}`)
        .set(bearer('nurse-b'))
        .expect(200);
      expect(checkB.body.status).toBe(BedStatus.OCCUPIED);
      expect(checkB.body.patientId).toBe(PATIENT_B_ID);
    });
  });
});
