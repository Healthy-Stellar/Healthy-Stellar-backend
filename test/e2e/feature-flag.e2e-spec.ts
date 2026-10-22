import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { FeatureFlagModule } from '../../src/feature-flags/feature-flag.module';
import { AuthModule } from '../../src/auth/auth.module';
import { CommonModule } from '../../src/common/common.module';

import { FeatureFlag } from '../../src/feature-flags/feature-flag.entity';
import { User } from '../../src/auth/entities/user.entity';
import { SessionEntity } from '../../src/auth/entities/session.entity';
import { MfaEntity } from '../../src/auth/entities/mfa.entity';
import { AuditLogEntity } from '../../src/common/audit/audit-log.entity';
import { AuditLog } from '../../src/common/entities/audit-log.entity';
import { SensitiveAuditLog } from '../../src/common/entities/sensitive-audit-log.entity';
import { Patient } from '../../src/patients/entities/patient.entity';
import { WebhookDelivery } from '../../src/webhooks/entities/webhook-delivery.entity';
import { WebhookSubscription } from '../../src/webhooks/entities/webhook-subscription.entity';
import { Record } from '../../src/records/entities/record.entity';
import { RecordVersion } from '../../src/records/versions/record-version.entity';
import { RecordSnapshot } from '../../src/records/entities/record-snapshot.entity';
import { RecordTemplate } from '../../src/records/entities/record-template.entity';
import { RecordAttachment } from '../../src/records/entities/record-attachment.entity';
import { RecordEvent } from '../../src/records/entities/record-event.entity';
import { EmergencyOverride } from '../../src/entities/emergency-override.entity';
import { MedicalAuditLog } from '../../src/entities/medical-audit-log.entity';
import { ApiKey } from '../../src/auth/entities/api-key.entity';

describe('FeatureFlag E2E', () => {
  let app: INestApplication;
  let adminToken: string;
  let nonAdminToken: string;

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
          entities: [
            FeatureFlag,
            User,
            SessionEntity,
            MfaEntity,
            AuditLogEntity,
            AuditLog,
            SensitiveAuditLog,
            Patient,
            WebhookDelivery,
            WebhookSubscription,
            Record,
            RecordVersion,
            RecordSnapshot,
            RecordTemplate,
            RecordAttachment,
            RecordEvent,
            EmergencyOverride,
            MedicalAuditLog,
            ApiKey,
          ],
          synchronize: true,
          dropSchema: true,
        }),
        CommonModule,
        AuthModule,
        FeatureFlagModule,
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

    // Create admin user and login
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'admin-ff@test.com',
        password: 'SecurePassword123!',
        firstName: 'Admin',
        lastName: 'User',
        role: 'admin',
      });

    const adminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'admin-ff@test.com',
        password: 'SecurePassword123!',
      });
    adminToken = adminLogin.body.accessToken;

    // Create non-admin user (patient) and login
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'user-ff@test.com',
        password: 'SecurePassword123!',
        firstName: 'Standard',
        lastName: 'Patient',
        role: 'patient',
      });

    const nonAdminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'user-ff@test.com',
        password: 'SecurePassword123!',
      });
    nonAdminToken = nonAdminLogin.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /admin/feature-flags', () => {
    it('returns 401 without token', async () => {
      await request(app.getHttpServer())
        .get('/admin/feature-flags')
        .expect(401);
    });

    it('returns 403 for non-admin role', async () => {
      await request(app.getHttpServer())
        .get('/admin/feature-flags')
        .set('Authorization', `Bearer ${nonAdminToken}`)
        .expect(403);
    });

    it('returns 200 for admin role with valid token', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/feature-flags')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('POST /admin/feature-flags', () => {
    it('returns 401 without token', async () => {
      await request(app.getHttpServer())
        .post('/admin/feature-flags')
        .send({ key: 'test-flag', enabled: true })
        .expect(401);
    });

    it('returns 403 for non-admin role', async () => {
      await request(app.getHttpServer())
        .post('/admin/feature-flags')
        .set('Authorization', `Bearer ${nonAdminToken}`)
        .send({ key: 'test-flag', enabled: true })
        .expect(403);
    });

    it('returns 201 and creates the flag for admin', async () => {
      const response = await request(app.getHttpServer())
        .post('/admin/feature-flags')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          key: 'telemedicine-integration',
          enabled: true,
          description: 'Enables virtual consultation modules',
        })
        .expect(201);

      expect(response.body).toHaveProperty('key', 'telemedicine-integration');
      expect(response.body).toHaveProperty('enabled', true);
    });
  });

  describe('PATCH /admin/feature-flags/:key/rollback', () => {
    beforeAll(async () => {
      // Ensure the flag exists
      await request(app.getHttpServer())
        .post('/admin/feature-flags')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          key: 'rollback-test-flag',
          enabled: true,
        });
    });

    it('returns 401 without token', async () => {
      await request(app.getHttpServer())
        .patch('/admin/feature-flags/rollback-test-flag/rollback')
        .expect(401);
    });

    it('returns 403 for non-admin role', async () => {
      await request(app.getHttpServer())
        .patch('/admin/feature-flags/rollback-test-flag/rollback')
        .set('Authorization', `Bearer ${nonAdminToken}`)
        .expect(403);
    });

    it('rolls back correctly for admin role and disables the flag', async () => {
      const response = await request(app.getHttpServer())
        .patch('/admin/feature-flags/rollback-test-flag/rollback')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('key', 'rollback-test-flag');
      expect(response.body).toHaveProperty('enabled', false);

      // Verify via GET
      const getResponse = await request(app.getHttpServer())
        .get('/admin/feature-flags')
        .set('Authorization', `Bearer ${adminToken}`);
      
      const flag = getResponse.body.find((f: any) => f.key === 'rollback-test-flag');
      expect(flag).toBeDefined();
      expect(flag.enabled).toBe(false);
    });
  });
});
