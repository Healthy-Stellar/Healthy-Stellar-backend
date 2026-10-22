import { INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AuthTokenService } from '../auth/services/auth-token.service';
import { SessionManagementService } from '../auth/services/session-management.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { FeatureFlagController } from './feature-flag.controller';
import { FeatureFlagService } from './feature-flag.service';

describe('FeatureFlagController auth', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [FeatureFlagController],
      providers: [
        JwtAuthGuard,
        RolesGuard,
        Reflector,
        {
          provide: AuthTokenService,
          useValue: {
            verifyAccessToken: jest.fn(),
          },
        },
        {
          provide: SessionManagementService,
          useValue: {
            isSessionValid: jest.fn(),
            updateSessionActivity: jest.fn(),
          },
        },
        {
          provide: FeatureFlagService,
          useValue: {
            findAll: jest.fn(),
            upsert: jest.fn(),
            rollback: jest.fn(),
          },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it.each([
    ['GET', '/admin/feature-flags'],
    ['POST', '/admin/feature-flags'],
    ['PATCH', '/admin/feature-flags/test-flag/rollback'],
  ])('returns 401 for unauthenticated %s %s', async (method, path) => {
    const agent = request(app.getHttpServer());
    const response =
      method === 'GET'
        ? agent.get(path)
        : method === 'POST'
          ? agent.post(path).send({ key: 'test-flag', enabled: true })
          : agent.patch(path);

    await response.expect(401);
  });
});
