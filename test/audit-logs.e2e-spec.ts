/**
 * E2E tests for GET /admin/audit-logs
 *
 * Uses a minimal NestJS testing module that wires up only the
 * AdminAuditLogsController + a mocked AuditLogService. The three
 * guards (IpAllowlistGuard, JwtAuthGuard, RolesGuard) are overridden
 * via APP_GUARD providers so we can control 401/403 scenarios without
 * needing a real DB or JWT infrastructure.
 */
import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import * as request from 'supertest';
import { AdminAuditLogsController } from '../src/admin/controllers/admin-audit-logs.controller';
import { AuditLogService, PaginatedAuditLogs } from '../src/common/services/audit-log.service';
import { SensitiveAuditLog } from '../src/common/entities/sensitive-audit-log.entity';
import { PhiAuditAction } from '../src/common/audit/dto/query-audit-logs.dto';
import { IpAllowlistGuard } from '../src/common/guards/ip-allowlist.guard';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../src/auth/guards/roles.guard';
import { PaginatedResponseDto, PaginationMetaDto } from '../src/common/dto/paginated-response.dto';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildMeta(
  total: number,
  page = 1,
  pageSize = 20,
): PaginationMetaDto {
  return {
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
    hasNextPage: page < Math.ceil(total / pageSize),
    hasPrevPage: page > 1,
  };
}

function buildPaginatedLogs(
  rows: Partial<SensitiveAuditLog>[],
  total: number,
  page = 1,
  pageSize = 20,
): PaginatedAuditLogs {
  return new PaginatedResponseDto(rows as SensitiveAuditLog[], buildMeta(total, page, pageSize));
}

const sampleLogs: Partial<SensitiveAuditLog>[] = [
  {
    id: 'log-uuid-1',
    actorAddress: 'user-123',
    action: PhiAuditAction.READ,
    resourceType: 'MedicalRecord',
    resourceId: 'record-uuid-1',
    ipAddress: '10.0.0.1',
    timestamp: new Date('2024-06-01T10:00:00Z'),
  },
  {
    id: 'log-uuid-2',
    actorAddress: 'user-456',
    action: PhiAuditAction.WRITE,
    resourceType: 'MedicalRecord',
    resourceId: 'record-uuid-2',
    ipAddress: '10.0.0.2',
    timestamp: new Date('2024-06-02T11:00:00Z'),
  },
];

// ---------------------------------------------------------------------------
// Guard factories
// ---------------------------------------------------------------------------

/** A guard that always passes (IP allowlist + authenticated admin). */
class AllowAllGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    return true;
  }
}

/** Simulates the JwtAuthGuard for an authenticated non-admin user. */
class AuthenticatedNonAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    // Attach a non-admin user to the request so RolesGuard can inspect it
    const req = context.switchToHttp().getRequest();
    req.user = { id: 'user-non-admin', role: 'patient' };
    return true;
  }
}

/** Simulates the JwtAuthGuard for an authenticated admin user. */
class AuthenticatedAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    req.user = { id: 'user-admin', role: 'admin' };
    return true;
  }
}

/** Simulates JwtAuthGuard rejecting with 401 (no token). */
class UnauthenticatedGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    throw new UnauthorizedException('No token provided');
  }
}

/** Simulates RolesGuard rejecting a non-admin with 403. */
class ForbiddenRolesGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    throw new ForbiddenException('Access denied. Required roles: admin');
  }
}

// ---------------------------------------------------------------------------
// Test app factory
// ---------------------------------------------------------------------------

interface BuildAppOptions {
  /** Override for JwtAuthGuard */
  jwtGuard?: CanActivate;
  /** Override for RolesGuard */
  rolesGuard?: CanActivate;
}

async function buildApp(opts: BuildAppOptions = {}): Promise<{
  app: INestApplication;
  auditLogService: jest.Mocked<Partial<AuditLogService>>;
}> {
  const auditLogService: jest.Mocked<Partial<AuditLogService>> = {
    findAllSensitive: jest.fn().mockResolvedValue(buildPaginatedLogs(sampleLogs, 2)),
  };

  const module: TestingModule = await Test.createTestingModule({
    controllers: [AdminAuditLogsController],
    providers: [
      { provide: AuditLogService, useValue: auditLogService },
    ],
  })
    // Override each guard individually — IpAllowlistGuard always passes in tests
    .overrideGuard(IpAllowlistGuard)
    .useValue(new AllowAllGuard())
    .overrideGuard(JwtAuthGuard)
    .useValue(opts.jwtGuard ?? new AuthenticatedAdminGuard())
    .overrideGuard(RolesGuard)
    .useValue(opts.rolesGuard ?? new AllowAllGuard())
    .compile();

  const app = module.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  await app.init();

  return { app, auditLogService };
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------
describe('GET /admin/audit-logs (e2e)', () => {
  // -------------------------------------------------------------------------
  // 1. Returns 401 without auth token
  // -------------------------------------------------------------------------
  describe('authentication', () => {
    let app: INestApplication;

    beforeAll(async () => {
      ({ app } = await buildApp({ jwtGuard: new UnauthenticatedGuard() }));
    });

    afterAll(() => app.close());

    it('returns 401 when no authentication token is provided', async () => {
      await request(app.getHttpServer()).get('/admin/audit-logs').expect(401);
    });
  });

  // -------------------------------------------------------------------------
  // 2. Returns 403 for non-admin users
  // -------------------------------------------------------------------------
  describe('authorization', () => {
    let app: INestApplication;

    beforeAll(async () => {
      ({ app } = await buildApp({
        jwtGuard: new AuthenticatedNonAdminGuard(),
        rolesGuard: new ForbiddenRolesGuard(),
      }));
    });

    afterAll(() => app.close());

    it('returns 403 when the authenticated user is not an admin', async () => {
      await request(app.getHttpServer()).get('/admin/audit-logs').expect(403);
    });
  });

  // -------------------------------------------------------------------------
  // 3–8. Admin access scenarios
  // -------------------------------------------------------------------------
  describe('admin access', () => {
    let app: INestApplication;
    let auditLogService: jest.Mocked<Partial<AuditLogService>>;

    beforeAll(async () => {
      ({ app, auditLogService } = await buildApp());
    });

    afterAll(() => app.close());

    beforeEach(() => jest.clearAllMocks());

    // 3. Returns 200 with paginated data
    it('returns 200 with paginated audit log data for admin users', async () => {
      (auditLogService.findAllSensitive as jest.Mock).mockResolvedValue(
        buildPaginatedLogs(sampleLogs, 2),
      );

      const response = await request(app.getHttpServer())
        .get('/admin/audit-logs')
        .expect(200);

      expect(response.body).toMatchObject({
        data: expect.arrayContaining([
          expect.objectContaining({ actorAddress: 'user-123' }),
          expect.objectContaining({ actorAddress: 'user-456' }),
        ]),
        meta: expect.objectContaining({
          total: 2,
          page: 1,
          pageSize: 20,
        }),
      });

      expect(auditLogService.findAllSensitive).toHaveBeenCalledTimes(1);
    });

    // 4. patientId filter
    it('filters by patientId query param and passes it to findAllSensitive', async () => {
      const patientId = 'patient-uuid-abc123';
      (auditLogService.findAllSensitive as jest.Mock).mockResolvedValue(
        buildPaginatedLogs([], 0),
      );

      await request(app.getHttpServer())
        .get(`/admin/audit-logs?patientId=${patientId}`)
        .expect(200);

      expect(auditLogService.findAllSensitive).toHaveBeenCalledWith(
        expect.objectContaining({ patientId }),
      );
    });

    // 5. actionType filter
    it('filters by actionType=READ and passes it to findAllSensitive', async () => {
      (auditLogService.findAllSensitive as jest.Mock).mockResolvedValue(
        buildPaginatedLogs(
          sampleLogs.filter((l) => l.action === PhiAuditAction.READ),
          1,
        ),
      );

      const response = await request(app.getHttpServer())
        .get('/admin/audit-logs?actionType=READ')
        .expect(200);

      expect(auditLogService.findAllSensitive).toHaveBeenCalledWith(
        expect.objectContaining({ actionType: PhiAuditAction.READ }),
      );

      expect(response.body.meta.total).toBe(1);
    });

    // 6. Date range filter
    it('passes startDate and endDate to findAllSensitive', async () => {
      (auditLogService.findAllSensitive as jest.Mock).mockResolvedValue(
        buildPaginatedLogs(sampleLogs, 2),
      );

      await request(app.getHttpServer())
        .get('/admin/audit-logs?startDate=2024-01-01&endDate=2024-12-31')
        .expect(200);

      expect(auditLogService.findAllSensitive).toHaveBeenCalledWith(
        expect.objectContaining({
          startDate: '2024-01-01',
          endDate: '2024-12-31',
        }),
      );
    });

    // 7. Pagination params forwarded
    it('forwards page and pageSize to findAllSensitive', async () => {
      (auditLogService.findAllSensitive as jest.Mock).mockResolvedValue(
        buildPaginatedLogs([], 100, 2, 10),
      );

      const response = await request(app.getHttpServer())
        .get('/admin/audit-logs?page=2&pageSize=10')
        .expect(200);

      expect(auditLogService.findAllSensitive).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2, pageSize: 10 }),
      );

      expect(response.body.meta.page).toBe(2);
      expect(response.body.meta.pageSize).toBe(10);
    });

    // 8. Invalid actionType rejected by ValidationPipe
    it('returns 400 for an invalid actionType enum value', async () => {
      await request(app.getHttpServer())
        .get('/admin/audit-logs?actionType=INVALID_ACTION')
        .expect(400);
    });

    // 9. actorId filter
    it('passes actorId to findAllSensitive', async () => {
      const actorId = 'actor-user-id-xyz';
      (auditLogService.findAllSensitive as jest.Mock).mockResolvedValue(
        buildPaginatedLogs([], 0),
      );

      await request(app.getHttpServer())
        .get(`/admin/audit-logs?actorId=${actorId}`)
        .expect(200);

      expect(auditLogService.findAllSensitive).toHaveBeenCalledWith(
        expect.objectContaining({ actorId }),
      );
    });

    // 10. Empty result set handled gracefully
    it('returns 200 with empty data array when no logs match', async () => {
      (auditLogService.findAllSensitive as jest.Mock).mockResolvedValue(
        buildPaginatedLogs([], 0),
      );

      const response = await request(app.getHttpServer())
        .get('/admin/audit-logs')
        .expect(200);

      expect(response.body.data).toEqual([]);
      expect(response.body.meta.total).toBe(0);
    });
  });
});
