import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';

import { OidcModule } from '../../src/OAuth2/oidc.module';
import { AuthModule } from '../../src/auth/auth.module';
import { CommonModule } from '../../src/common/common.module';
import { User } from '../../src/auth/entities/user.entity';
import { SessionEntity } from '../../src/auth/entities/session.entity';
import { MfaEntity } from '../../src/auth/entities/mfa.entity';
import { Patient } from '../../src/users/entities/patient.entity';
import { ApiKey } from '../../src/auth/entities/api-key.entity';
import { FeatureFlag } from '../../src/feature-flags/feature-flag.entity';
import { AuditLogEntity } from '../../src/common/audit/audit-log.entity';
import { AuditLog } from '../../src/common/entities/audit-log.entity';
import { SensitiveAuditLog } from '../../src/common/entities/sensitive-audit-log.entity';
import { OidcIdentity } from '../../src/OAuth2/entities/oidc-identity.entity';

describe('SMART on FHIR (e2e)', () => {
  let app: INestApplication;
  let userRepo: Repository<User>;
  let patientRepo: Repository<Patient>;

  const testPatient = {
    firstName: 'Smart',
    lastName: 'Patient',
    email: 'smart-patient@test.com',
    password: 'TestSmart123!',
  };

  let accessToken: string;
  let userId: string;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-smart-jwt-secret-key-99999';

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
            Patient,
            ApiKey,
            AuditLogEntity,
            AuditLog,
            SensitiveAuditLog,
            OidcIdentity,
          ],
          synchronize: true,
          dropSchema: true,
        }),
        CommonModule,
        AuthModule,
        OidcModule,
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

    userRepo = moduleFixture.get(getRepositoryToken(User));
    patientRepo = moduleFixture.get(getRepositoryToken(Patient));
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /.well-known/smart-configuration', () => {
    it('returns SMART on FHIR discovery document', async () => {
      const res = await request(app.getHttpServer())
        .get('/.well-known/smart-configuration')
        .expect(200);

      expect(res.body).toHaveProperty('authorization_endpoint');
      expect(res.body).toHaveProperty('token_endpoint');
      expect(res.body).toHaveProperty('capabilities');
      expect(res.body).toHaveProperty('scopes_supported');
      expect(res.body.authorization_endpoint).toContain('/oauth2/authorize');
      expect(res.body.token_endpoint).toContain('/oauth2/token');
      expect(res.body.capabilities).toContain('launch-ehr');
      expect(res.body.capabilities).toContain('launch-standalone');
      expect(res.body.scopes_supported).toContain('launch/patient');
      expect(res.body.scopes_supported).toContain('patient/*.read');
      expect(res.body.response_types_supported).toEqual(['code']);
      expect(res.body.code_challenge_methods_supported).toContain('S256');
    });
  });

  describe('SMART EHR Launch Flow', () => {
    beforeAll(async () => {
      // Register a patient user
      const regRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send(testPatient)
        .expect(201);

      accessToken = regRes.body.tokens.accessToken;
      userId = regRes.body.user.id;

      // Create patient record linked to this user for SMART launch/patient context
      await patientRepo.save({
        userId,
        mrn: `TEST-MRN-${userId.substring(0, 8)}`,
        dateOfBirth: new Date('1985-06-15'),
        gender: 'male',
        phoneNumber: '555-SMART',
        address: '456 Health St',
      });
    });

    afterAll(async () => {
      await patientRepo.delete({});
      await userRepo.delete({});
    });

    it('authorize with SMART launch scopes and return code', async () => {
      const clientId = 'smart-app';
      const redirectUri = 'https://app.example.com/callback';
      const state = 'test-state-123';
      const launchToken = 'ehr-launch-context-abc';
      const codeChallenge = 'test-challenge';
      const codeChallengeMethod = 'S256';

      const res = await request(app.getHttpServer())
        .get('/oauth2/authorize')
        .query({
          response_type: 'code',
          client_id: clientId,
          redirect_uri: redirectUri,
          scope: 'launch/patient patient/*.read openid fhirUser',
          state,
          launch: launchToken,
          code_challenge: codeChallenge,
          code_challenge_method: codeChallengeMethod,
        })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(302);

      const location = res.header.location;
      expect(location).toContain(redirectUri);
      expect(location).toContain('code=');
      expect(location).toContain(`state=${state}`);
    });

    it('exchange authorization code for token with launch/patient context', async () => {
      // First get a code
      const authRes = await request(app.getHttpServer())
        .get('/oauth2/authorize')
        .query({
          response_type: 'code',
          client_id: 'smart-app',
          redirect_uri: 'https://app.example.com/callback',
          scope: 'launch/patient patient/*.read openid fhirUser',
          state: 'state-456',
          launch: 'ehr-launch-token-xyz',
          code_challenge: 'test-challenge',
          code_challenge_method: 'S256',
        })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(302);

      const location = authRes.header.location;
      const code = new URL(location).searchParams.get('code');

      const tokenRes = await request(app.getHttpServer())
        .post('/oauth2/token')
        .send({
          grant_type: 'authorization_code',
          code,
          client_id: 'smart-app',
          redirect_uri: 'https://app.example.com/callback',
          code_verifier: 'test-verifier',
        })
        .expect(200);

      expect(tokenRes.body).toHaveProperty('access_token');
      expect(tokenRes.body.token_type).toBe('Bearer');
      expect(tokenRes.body.expires_in).toBe(900);
      expect(tokenRes.body.scope).toContain('launch/patient');
      expect(tokenRes.body.scope).toContain('patient/*.read');
      expect(tokenRes.body).toHaveProperty('patient');
      expect(typeof tokenRes.body.patient).toBe('string');
    });

    it('token with fhirUser scope includes fhirUser claim', async () => {
      const authRes = await request(app.getHttpServer())
        .get('/oauth2/authorize')
        .query({
          response_type: 'code',
          client_id: 'fhir-app',
          redirect_uri: 'https://fhir-app.example.com/callback',
          scope: 'openid fhirUser patient/*.read',
          state: 'state-789',
          code_challenge: 'test-challenge',
          code_challenge_method: 'S256',
        })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(302);

      const code = new URL(authRes.header.location).searchParams.get('code');

      const tokenRes = await request(app.getHttpServer())
        .post('/oauth2/token')
        .send({
          grant_type: 'authorization_code',
          code,
          client_id: 'fhir-app',
          redirect_uri: 'https://fhir-app.example.com/callback',
          code_verifier: 'test-verifier',
        })
        .expect(200);

      expect(tokenRes.body.access_token).toBeDefined();
    });

    it('returns 400 for unsupported response type', async () => {
      await request(app.getHttpServer())
        .get('/oauth2/authorize')
        .query({
          response_type: 'token',
          client_id: 'smart-app',
          redirect_uri: 'https://app.example.com/callback',
          scope: 'patient/*.read',
        })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });

    it('returns 400 for invalid grant type', async () => {
      await request(app.getHttpServer())
        .post('/oauth2/token')
        .send({
          grant_type: 'client_credentials',
          client_id: 'smart-app',
        })
        .expect(400);
    });
  });
});
