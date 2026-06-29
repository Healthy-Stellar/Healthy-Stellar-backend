import { Controller, Get, UseGuards, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { Repository } from 'typeorm';

import { TenantConfigModule } from '../../src/tenant-config/tenant-config.module';
import { AuthModule } from '../../src/auth/auth.module';
import { CommonModule } from '../../src/common/common.module';
import { TenantIpAllowlistGuard } from '../../src/tenant-config/guards/tenant-ip-allowlist.guard';
import { TenantConfig } from '../../src/tenant-config/entities/tenant-config.entity';
import { SUPPORTED_CONFIG_KEYS } from '../../src/tenant-config/constants/config-keys.constant';
import { SessionEntity } from '../../src/auth/entities/session.entity';
import { MfaEntity } from '../../src/auth/entities/mfa.entity';
import { AuditLogEntity } from '../../src/common/audit/audit-log.entity';
import { AuditLog } from '../../src/common/entities/audit-log.entity';
import { SensitiveAuditLog } from '../../src/common/entities/sensitive-audit-log.entity';

@Controller('__test_ip_allowlist')
@UseGuards(TenantIpAllowlistGuard)
class TestIpController {
  @Get()
  get() {
    return { ok: true };
  }
}

describe('Tenant IP Allowlist (e2e)', () => {
  let app: INestApplication;
  let configRepo: Repository<TenantConfig>;

  const tenantId = '11111111-1111-1111-1111-111111111111';

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-ip-allowlist-jwt-secret-99999';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [
            TenantConfig,
            User,
            SessionEntity,
            MfaEntity,
            AuditLogEntity,
            AuditLog,
            SensitiveAuditLog,
          ],
          synchronize: true,
          dropSchema: true,
        }),
        CommonModule,
        AuthModule,
        TenantConfigModule,
      ],
      controllers: [TestIpController],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();

    configRepo = moduleFixture.get(getRepositoryToken(TenantConfig));
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Default behavior (empty allowlist)', () => {
    it('allows requests when no allowlist is configured for the tenant', async () => {
      const res = await request(app.getHttpServer())
        .get('/__test_ip_allowlist')
        .set('x-tenant-id', tenantId)
        .set('x-forwarded-for', '10.0.0.1');

      expect(res.status).toBe(200);
    });

    it('allows requests when no tenant ID is present', async () => {
      const res = await request(app.getHttpServer())
        .get('/__test_ip_allowlist')
        .set('x-forwarded-for', '10.0.0.1');

      expect(res.status).toBe(200);
    });
  });

  describe('With allowlist configured', () => {
    beforeAll(async () => {
      await configRepo.save({
        tenantId,
        key: SUPPORTED_CONFIG_KEYS.IP_ALLOWLIST,
        value: JSON.stringify(['10.0.0.0/8', '192.168.1.100']),
        valueType: 'array',
      });
    });

    afterAll(async () => {
      await configRepo.delete({
        tenantId,
        key: SUPPORTED_CONFIG_KEYS.IP_ALLOWLIST,
      });
    });

    it('allows requests from a CIDR-range IP', async () => {
      const res = await request(app.getHttpServer())
        .get('/__test_ip_allowlist')
        .set('x-tenant-id', tenantId)
        .set('x-forwarded-for', '10.0.0.50');

      expect(res.status).toBe(200);
    });

    it('allows requests from an exact-match IP', async () => {
      const res = await request(app.getHttpServer())
        .get('/__test_ip_allowlist')
        .set('x-tenant-id', tenantId)
        .set('x-forwarded-for', '192.168.1.100');

      expect(res.status).toBe(200);
    });

    it('returns 403 for requests from a non-allowlisted IP', async () => {
      const res = await request(app.getHttpServer())
        .get('/__test_ip_allowlist')
        .set('x-tenant-id', tenantId)
        .set('x-forwarded-for', '1.2.3.4');

      expect(res.status).toBe(403);
    });

    it('returns 403 for requests from a CIDR range that does not match', async () => {
      const res = await request(app.getHttpServer())
        .get('/__test_ip_allowlist')
        .set('x-tenant-id', tenantId)
        .set('x-forwarded-for', '172.16.0.1');

      expect(res.status).toBe(403);
    });

    it('respects x-real-ip header when x-forwarded-for is not present', async () => {
      const res = await request(app.getHttpServer())
        .get('/__test_ip_allowlist')
        .set('x-tenant-id', tenantId)
        .set('x-real-ip', '10.0.0.99');

      expect(res.status).toBe(200);
    });

    it('returns 403 for non-allowlisted IP via x-real-ip header', async () => {
      const res = await request(app.getHttpServer())
        .get('/__test_ip_allowlist')
        .set('x-tenant-id', tenantId)
        .set('x-real-ip', '99.99.99.99');

      expect(res.status).toBe(403);
    });
  });
});
