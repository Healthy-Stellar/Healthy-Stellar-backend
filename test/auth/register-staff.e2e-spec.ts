import { CanActivate, ExecutionContext, INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { AuthController } from '../../src/auth/controllers/auth.controller';
import { AuthService } from '../../src/auth/services/auth.service';
import { AuthTokenService } from '../../src/auth/services/auth-token.service';
import { MfaService } from '../../src/auth/services/mfa.service';
import { SessionManagementService } from '../../src/auth/services/session-management.service';
import { RefreshTokenStoreService } from '../../src/auth/services/refresh-token-store.service';
import { PasswordValidationService } from '../../src/auth/services/password-validation.service';
import { AuditLogService } from '../../src/common/services/audit-log.service';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard';
import { User, UserRole } from '../../src/auth/entities/user.entity';

const ORG_ID = '11111111-1111-4111-8111-111111111111';

class HeaderAuthGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const role = req.headers['x-test-role'];
    if (!role) throw new UnauthorizedException();
    req.user = { userId: 'caller-1', role, organizationId: ORG_ID };
    return true;
  }
}

describe('POST /auth/register/staff (e2e)', () => {
  let app: INestApplication;
  const userRepository = {
    findOne: jest.fn(),
    create: jest.fn((v) => ({ ...v })),
    save: jest.fn(async (v) => ({ id: 'new-user', mfaEnabled: false, ...v })),
  };

  const body = (role: string, extra: object = {}) => ({
    email: 'staff@example.test',
    password: 'Str0ng!Passw0rd#',
    firstName: 'Staff',
    lastName: 'Member',
    role,
    ...extra,
  });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: userRepository },
        {
          provide: PasswordValidationService,
          useValue: {
            validatePassword: () => ({ isValid: true, errors: [] }),
            hashPassword: async () => 'hash',
          },
        },
        { provide: AuditLogService, useValue: { log: jest.fn() } },
        { provide: AuthTokenService, useValue: {} },
        { provide: MfaService, useValue: {} },
        { provide: SessionManagementService, useValue: {} },
        { provide: RefreshTokenStoreService, useValue: {} },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(HeaderAuthGuard)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    await app.init();
  });

  beforeEach(() => {
    userRepository.findOne.mockResolvedValue(null);
    userRepository.create.mockClear();
  });

  afterAll(() => app.close());

  const post = (payload: object, role?: string) => {
    const req = request(app.getHttpServer()).post('/auth/register/staff');
    if (role) req.set('x-test-role', role);
    return req.send(payload);
  };

  it('rejects anonymous callers with 401', async () => {
    await post(body(UserRole.SUPER_ADMIN)).expect(401);
    expect(userRepository.create).not.toHaveBeenCalled();
  });

  it.each([UserRole.PATIENT, UserRole.PHYSICIAN])('rejects %s callers with 403', async (role) => {
    await post(body(UserRole.NURSE), role).expect(403);
  });

  it('lets an admin create staff, scoped to the admin tenant, without tokens', async () => {
    const res = await post(body(UserRole.PHYSICIAN), UserRole.ADMIN).expect(201);
    expect(res.body.user.role).toBe(UserRole.PHYSICIAN);
    expect(res.body.tokens).toBeUndefined();
    expect(userRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ role: UserRole.PHYSICIAN, organizationId: ORG_ID }),
    );
  });

  it('prevents an admin from creating admin or super_admin accounts', async () => {
    await post(body(UserRole.SUPER_ADMIN), UserRole.ADMIN).expect(403);
    await post(body(UserRole.ADMIN), UserRole.ADMIN).expect(403);
  });

  it('lets a super_admin create an admin', async () => {
    await post(body(UserRole.ADMIN), UserRole.SUPER_ADMIN).expect(201);
  });

  it('rejects the patient role and unknown fields via DTO validation', async () => {
    await post(body(UserRole.PATIENT), UserRole.ADMIN).expect(400);
    await post(body('not_a_role'), UserRole.ADMIN).expect(400);
    await post(body(UserRole.NURSE, { organizationId: 'x' }), UserRole.ADMIN).expect(400);
  });
});
