import { INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AuthTokenService } from '../../auth/services/auth-token.service';
import { SessionManagementService } from '../../auth/services/session-management.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { UserRole } from '../../auth/entities/user.entity';
import { SurgicalController } from './surgical.controller';
import { SurgicalService } from './surgical.service';

describe('SurgicalController auth — POST /surgical/cases/:id/checklist', () => {
  let app: INestApplication;
  let verifyAccessToken: jest.Mock;
  let isSessionValid: jest.Mock;

  const mockSurgicalService = {
    submitChecklist: jest.fn().mockResolvedValue({ id: 'checklist-1', isComplete: false }),
    getChecklistForCase: jest.fn(),
  };

  beforeAll(async () => {
    verifyAccessToken = jest.fn();
    isSessionValid = jest.fn().mockResolvedValue(true);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [SurgicalController],
      providers: [
        JwtAuthGuard,
        RolesGuard,
        Reflector,
        {
          provide: AuthTokenService,
          useValue: { verifyAccessToken },
        },
        {
          provide: SessionManagementService,
          useValue: {
            isSessionValid,
            updateSessionActivity: jest.fn(),
          },
        },
        {
          provide: SurgicalService,
          useValue: mockSurgicalService,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    verifyAccessToken.mockReset();
    mockSurgicalService.submitChecklist.mockClear();
  });

  const payload = { items: [{ label: 'Patient identity confirmed', completed: true }] };

  it('returns 401 when no token is provided', async () => {
    await request(app.getHttpServer())
      .post('/surgical/cases/case-1/checklist')
      .send(payload)
      .expect(401);
  });

  it('returns 403 when the authenticated user has a role other than NURSE or SURGEON', async () => {
    verifyAccessToken.mockReturnValue({
      userId: 'user-1',
      role: UserRole.PATIENT,
      sessionId: 'session-1',
    });

    await request(app.getHttpServer())
      .post('/surgical/cases/case-1/checklist')
      .set('Authorization', 'Bearer valid-token')
      .send(payload)
      .expect(403);

    expect(mockSurgicalService.submitChecklist).not.toHaveBeenCalled();
  });

  it('allows a NURSE to submit the checklist', async () => {
    verifyAccessToken.mockReturnValue({
      userId: 'nurse-1',
      role: UserRole.NURSE,
      sessionId: 'session-1',
    });

    await request(app.getHttpServer())
      .post('/surgical/cases/case-1/checklist')
      .set('Authorization', 'Bearer valid-token')
      .send(payload)
      .expect(201);

    expect(mockSurgicalService.submitChecklist).toHaveBeenCalledWith(
      'case-1',
      payload,
      'nurse-1',
    );
  });

  it('allows a SURGEON to submit the checklist', async () => {
    verifyAccessToken.mockReturnValue({
      userId: 'surgeon-1',
      role: UserRole.SURGEON,
      sessionId: 'session-1',
    });

    await request(app.getHttpServer())
      .post('/surgical/cases/case-1/checklist')
      .set('Authorization', 'Bearer valid-token')
      .send(payload)
      .expect(201);

    expect(mockSurgicalService.submitChecklist).toHaveBeenCalledWith(
      'case-1',
      payload,
      'surgeon-1',
    );
  });

  it('returns 403 for an ADMIN (not a clinical role permitted to complete the checklist)', async () => {
    verifyAccessToken.mockReturnValue({
      userId: 'admin-1',
      role: UserRole.ADMIN,
      sessionId: 'session-1',
    });

    await request(app.getHttpServer())
      .post('/surgical/cases/case-1/checklist')
      .set('Authorization', 'Bearer valid-token')
      .send(payload)
      .expect(403);
  });
});
