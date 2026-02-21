import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { TenantConfigModule } from '../../src/tenant-config/tenant-config.module';
import { AuthModule } from '../../src/auth/auth.module';
import { CommonModule } from '../../src/common/common.module';
import { SUPPORTED_CONFIG_KEYS } from '../../src/tenant-config/constants/config-keys.constant';

describe('TenantConfig E2E', () => {
  let app: INestApplication;
  let authToken: string;
  const testTenantId = '11111111-1111-1111-1111-111111111111';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [__dirname + '/../../src/**/*.entity{.ts,.js}'],
          synchronize: true,
          dropSchema: true,
        }),
        CommonModule,
        AuthModule,
        TenantConfigModule,
      ],
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

    // Create admin user and get auth token
    const registerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'admin@test.com',
        password: 'SecurePassword123!',
        firstName: 'Admin',
        lastName: 'User',
        role: 'admin',
      });

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'admin@test.com',
        password: 'SecurePassword123!',
      });

    authToken = loginResponse.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /admin/tenants/:id/config', () => {
    it('should return all tenant configurations', async () => {
      const response = await request(app.getHttpServer())
        .get(`/admin/tenants/${testTenantId}/config`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('tenantId', testTenantId);
      expect(response.body).toHaveProperty('configs');
      expect(Array.isArray(response.body.configs)).toBe(true);
    });

    it('should return 401 without authentication', async () => {
      await request(app.getHttpServer())
        .get(`/admin/tenants/${testTenantId}/config`)
        .expect(401);
    });
  });

  describe('GET /admin/tenants/:id/config/:key', () => {
    it('should return specific configuration value', async () => {
      const response = await request(app.getHttpServer())
        .get(`/admin/tenants/${testTenantId}/config/${SUPPORTED_CONFIG_KEYS.AUDIT_RETENTION_DAYS}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('tenantId', testTenantId);
      expect(response.body).toHaveProperty('key', SUPPORTED_CONFIG_KEYS.AUDIT_RETENTION_DAYS);
      expect(response.body).toHaveProperty('value');
    });
  });

  describe('PATCH /admin/tenants/:id/config', () => {
    it('should update tenant configuration', async () => {
      const updateDto = {
        key: SUPPORTED_CONFIG_KEYS.MAX_RECORD_SIZE_MB,
        value: '100',
        valueType: 'number',
      };

      const response = await request(app.getHttpServer())
        .patch(`/admin/tenants/${testTenantId}/config`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateDto)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Configuration updated successfully');
      expect(response.body.config).toHaveProperty('key', SUPPORTED_CONFIG_KEYS.MAX_RECORD_SIZE_MB);
      expect(response.body.config).toHaveProperty('value', '100');
    });

    it('should reject invalid configuration key', async () => {
      const updateDto = {
        key: 'invalid_key',
        value: 'some_value',
      };

      await request(app.getHttpServer())
        .patch(`/admin/tenants/${testTenantId}/config`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateDto)
        .expect(400);
    });

    it('should validate required fields', async () => {
      await request(app.getHttpServer())
        .patch(`/admin/tenants/${testTenantId}/config`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);
    });
  });

  describe('PATCH /admin/tenants/:id/config/bulk', () => {
    it('should bulk update multiple configurations', async () => {
      const bulkUpdateDto = {
        configs: [
          {
            key: SUPPORTED_CONFIG_KEYS.AUDIT_RETENTION_DAYS,
            value: '365',
            valueType: 'number',
          },
          {
            key: SUPPORTED_CONFIG_KEYS.FHIR_EXPORT_ENABLED,
            value: 'false',
            valueType: 'boolean',
          },
        ],
      };

      const response = await request(app.getHttpServer())
        .patch(`/admin/tenants/${testTenantId}/config/bulk`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(bulkUpdateDto)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Configurations updated successfully');
      expect(response.body).toHaveProperty('count', 2);
      expect(response.body.configs).toHaveLength(2);
    });
  });

  describe('DELETE /admin/tenants/:id/config/:key', () => {
    it('should delete tenant configuration', async () => {
      // First create a config
      await request(app.getHttpServer())
        .patch(`/admin/tenants/${testTenantId}/config`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          key: SUPPORTED_CONFIG_KEYS.SESSION_TIMEOUT_MINUTES,
          value: '30',
          valueType: 'number',
        });

      // Then delete it
      const response = await request(app.getHttpServer())
        .delete(`/admin/tenants/${testTenantId}/config/${SUPPORTED_CONFIG_KEYS.SESSION_TIMEOUT_MINUTES}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty(
        'message',
        'Configuration deleted successfully (reverted to default)',
      );
    });

    it('should return 404 for non-existent configuration', async () => {
      await request(app.getHttpServer())
        .delete(`/admin/tenants/${testTenantId}/config/non_existent_key`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('GET /admin/tenants/:id/features/:featureKey', () => {
    it('should check if feature is enabled', async () => {
      const response = await request(app.getHttpServer())
        .get(`/admin/tenants/${testTenantId}/features/${SUPPORTED_CONFIG_KEYS.FHIR_EXPORT_ENABLED}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('tenantId', testTenantId);
      expect(response.body).toHaveProperty('featureKey', SUPPORTED_CONFIG_KEYS.FHIR_EXPORT_ENABLED);
      expect(response.body).toHaveProperty('enabled');
      expect(typeof response.body.enabled).toBe('boolean');
    });
  });

  describe('Configuration Resolution Order', () => {
    it('should use tenant-specific config over global default', async () => {
      // Set tenant-specific config
      await request(app.getHttpServer())
        .patch(`/admin/tenants/${testTenantId}/config`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          key: SUPPORTED_CONFIG_KEYS.AUDIT_RETENTION_DAYS,
          value: '500',
          valueType: 'number',
        });

      // Retrieve config
      const response = await request(app.getHttpServer())
        .get(`/admin/tenants/${testTenantId}/config/${SUPPORTED_CONFIG_KEYS.AUDIT_RETENTION_DAYS}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.value).toBe(500);
    });
  });
});
