import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccessControlModule } from '../../src/access-control/access-control.module';
import { AccessGrant, AccessLevel } from '../../src/access-control/entities/access-grant.entity';

describe('Access Grant Lifecycle (e2e)', () => {
  let app: INestApplication;
  let grantId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [AccessGrant],
          synchronize: true,
        }),
        AccessControlModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /access/grant', () => {
    it('should grant access successfully', () => {
      return request(app.getHttpServer())
        .post('/access/grant')
        .send({
          granteeId: '123e4567-e89b-12d3-a456-426614174001',
          recordIds: ['123e4567-e89b-12d3-a456-426614174002'],
          accessLevel: AccessLevel.READ,
          expiresAt: '2025-12-31T23:59:59Z',
        })
        .expect(201)
        .then((response) => {
          expect(response.body).toHaveProperty('id');
          expect(response.body.accessLevel).toBe(AccessLevel.READ);
          expect(response.body.status).toBe('ACTIVE');
          grantId = response.body.id;
        });
    });

    it('should return 409 for duplicate grant', () => {
      return request(app.getHttpServer())
        .post('/access/grant')
        .send({
          granteeId: '123e4567-e89b-12d3-a456-426614174001',
          recordIds: ['123e4567-e89b-12d3-a456-426614174002'],
          accessLevel: AccessLevel.READ,
        })
        .expect(409);
    });
  });

  describe('GET /access/grants', () => {
    it('should list all active grants for patient', () => {
      return request(app.getHttpServer())
        .get('/access/grants')
        .expect(200)
        .then((response) => {
          expect(Array.isArray(response.body)).toBe(true);
          expect(response.body.length).toBeGreaterThan(0);
        });
    });
  });

  describe('GET /access/received', () => {
    it('should list all grants received by provider', () => {
      return request(app.getHttpServer())
        .get('/access/received')
        .expect(200)
        .then((response) => {
          expect(Array.isArray(response.body)).toBe(true);
        });
    });
  });

  describe('DELETE /access/grant/:grantId', () => {
    it('should revoke access successfully', () => {
      return request(app.getHttpServer())
        .delete(`/access/grant/${grantId}`)
        .query({ reason: 'No longer needed' })
        .expect(200)
        .then((response) => {
          expect(response.body.status).toBe('REVOKED');
          expect(response.body.revocationReason).toBe('No longer needed');
        });
    });

    it('should return 404 for non-existent grant', () => {
      return request(app.getHttpServer())
        .delete('/access/grant/123e4567-e89b-12d3-a456-426614174999')
        .expect(404);
    });
  });

  describe('Full grant → verify → revoke cycle', () => {
    it('should complete full lifecycle', async () => {
      // Grant
      const grantResponse = await request(app.getHttpServer())
        .post('/access/grant')
        .send({
          granteeId: '123e4567-e89b-12d3-a456-426614174003',
          recordIds: ['123e4567-e89b-12d3-a456-426614174004'],
          accessLevel: AccessLevel.READ_WRITE,
        })
        .expect(201);

      const newGrantId = grantResponse.body.id;

      // Verify
      const grantsResponse = await request(app.getHttpServer())
        .get('/access/grants')
        .expect(200);

      expect(grantsResponse.body.some((g) => g.id === newGrantId)).toBe(true);

      // Revoke
      await request(app.getHttpServer())
        .delete(`/access/grant/${newGrantId}`)
        .query({ reason: 'Test complete' })
        .expect(200);

      // Verify revocation
      const afterRevoke = await request(app.getHttpServer())
        .get('/access/grants')
        .expect(200);

      expect(afterRevoke.body.some((g) => g.id === newGrantId)).toBe(false);
    });
  });
});
