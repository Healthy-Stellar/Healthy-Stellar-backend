import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { OidcModule } from '../../src/OAuth2/oidc.module';
import { OidcAuthGuard } from '../../src/OAuth2/oidc-auth.guard';
import { OidcIdentity } from '../../src/OAuth2/oidc-identity.entity';
import { AuthModule } from '../../src/auth/auth.module';
import { CommonModule } from '../../src/common/common.module';
import { UserRole } from '../../src/auth/entities/user.entity';

import { FeatureFlag } from '../../src/feature-flags/entities/feature-flag.entity';
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

// Mock OIDC AuthGuard to simulate Identity Provider validating a profile
class MockOidcAuthGuard {
  canActivate(context: any) {
    const req = context.switchToHttp().getRequest();
    const provider = req.params.provider || 'azure';
    const code = req.query?.code || req.body?.code;

    if (code === 'invalid' || code === 'expired') {
      req.user = false;
      return false; // Triggers 401/403 or custom handling depending on guard
    }

    // Default mock profile populated on req.user by guard
    req.user = {
      provider,
      providerSubject: code === 'existing-subject' ? 'mock-existing-sub' : 'mock-new-sub-999',
      email: code === 'existing-subject' ? 'existing-oidc@test.com' : 'new-oidc-user@test.com',
      givenName: 'John',
      familyName: 'Oidc',
      rawClaims: { sub: code === 'existing-subject' ? 'mock-existing-sub' : 'mock-new-sub-999' },
      tokenSet: {},
    };
    return true;
  }
}

describe('OIDC E2E', () => {
  let app: INestApplication;
  let oidcToken: string;

  beforeAll(async () => {
    // Setup required environment variables for OidcModule configuration
    process.env.OIDC_PROVIDERS = 'azure';
    process.env.OIDC_AZURE_ISSUER = 'https://login.microsoftonline.com/test/v2.0';
    process.env.OIDC_AZURE_CLIENT_ID = 'test-client-id';
    process.env.OIDC_AZURE_CLIENT_SECRET = 'test-client-secret';
    process.env.OIDC_AZURE_REDIRECT_URI = 'http://localhost/auth/oidc/azure/callback';
    process.env.OIDC_AZURE_AUTHORIZATION_URL = 'https://login.microsoftonline.com/test/oauth2/v2.0/authorize';
    process.env.OIDC_AZURE_TOKEN_URL = 'https://login.microsoftonline.com/test/oauth2/v2.0/token';
    process.env.OIDC_AZURE_JWKS_URI = 'https://login.microsoftonline.com/test/discovery/v2.0/keys';
    process.env.JWT_SECRET = 'test-jwt-secret-key-12345';

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
          OidcIdentity,
          ],
          synchronize: true,
          dropSchema: true,
        }),
        CommonModule,
        AuthModule,
        OidcModule,
      ],
    })
      .overrideGuard(OidcAuthGuard)
      .useClass(MockOidcAuthGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /auth/oidc/providers', () => {
    it('returns list of configured providers', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/oidc/providers')
        .expect(200);

      expect(response.body).toHaveProperty('providers');
      expect(response.body.providers).toContain('azure');
    });
  });

  describe('GET /auth/oidc/:provider', () => {
    it('redirects to provider authorization URL', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/oidc/azure')
        .expect(302);

      expect(response.header.location).toContain('https://login.microsoftonline.com/test/oauth2/v2.0/authorize');
    });
  });

  describe('POST /auth/oidc/:provider/callback', () => {
    it('returns 403/401 for invalid code', async () => {
      await request(app.getHttpServer())
        .post('/auth/oidc/azure/callback')
        .send({ code: 'invalid' })
        .expect(403);
    });

    it('creates/provisions a new user on first OIDC callback', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/oidc/azure/callback')
        .send({ code: 'new-subject' })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('email', 'new-oidc-user@test.com');
      expect(response.body.user).toHaveProperty('role', 'patient'); // default self-provisioned role
    });

    it('logs in and returns existing user on subsequent callbacks', async () => {
      // First provision
      await request(app.getHttpServer())
        .post('/auth/oidc/azure/callback')
        .send({ code: 'existing-subject' });

      // Second callback
      const response = await request(app.getHttpServer())
        .post('/auth/oidc/azure/callback')
        .send({ code: 'existing-subject' })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body.user).toHaveProperty('email', 'existing-oidc@test.com');
    });
  });

  describe('GET /auth/oidc/:provider/callback', () => {
    it('redirects with oidc_token query parameter', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/oidc/azure/callback')
        .query({ code: 'new-subject' })
        .expect(302);

      expect(response.header.location).toContain('oidc_token=');
      expect(response.header.location).toContain('is_new_user=');
    });
  });
});
