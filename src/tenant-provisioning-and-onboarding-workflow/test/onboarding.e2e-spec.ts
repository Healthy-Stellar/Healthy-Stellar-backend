import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { OnboardingSession, OnboardingStep, OnboardingSessionStatus } from '../src/onboarding/entities/onboarding-session.entity';
import { OnboardingService } from '../src/onboarding/services/onboarding.service';
import { OnboardingController } from '../src/onboarding/controllers/onboarding.controller';

const mockSessionRepo = () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
});

const mockProvisioningService = () => ({
  provisionTenant: jest.fn(),
});

const mockEmailService = () => ({
  sendWelcomeEmail: jest.fn().mockResolvedValue(undefined),
});

describe('Onboarding flow (e2e)', () => {
  let app: INestApplication;
  let sessionRepo: ReturnType<typeof mockSessionRepo>;
  let provisioningService: ReturnType<typeof mockProvisioningService>;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [OnboardingController],
      providers: [
        OnboardingService,
        { provide: getRepositoryToken(OnboardingSession), useFactory: mockSessionRepo },
        { provide: 'ProvisioningService', useFactory: mockProvisioningService },
        { provide: 'EmailService', useFactory: mockEmailService },
      ],
    })
      .overrideProvider('ProvisioningService')
      .useFactory({ factory: mockProvisioningService })
      .overrideProvider('EmailService')
      .useFactory({ factory: mockEmailService })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    sessionRepo = moduleRef.get(getRepositoryToken(OnboardingSession));
    provisioningService = moduleRef.get('ProvisioningService');
  });

  afterEach(() => app.close());

  describe('Full onboarding wizard state machine', () => {
    const sessionId = 'session-uuid-1';
    const verificationToken = 'abc123verificationtoken';

    it('Step 1: POST /onboarding/register — creates session and returns REGISTRATION step', async () => {
      const createdSession = {
        id: sessionId,
        hospitalName: 'General Hospital',
        adminEmail: 'admin@general.com',
        plan: 'enterprise',
        dataResidencyRegion: 'us-east-1',
        currentStep: OnboardingStep.REGISTRATION,
        status: OnboardingSessionStatus.ACTIVE,
        verificationToken,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as OnboardingSession;

      sessionRepo.findOne.mockResolvedValue(null);
      sessionRepo.create.mockReturnValue(createdSession);
      sessionRepo.save.mockResolvedValue(createdSession);

      const res = await request(app.getHttpServer())
        .post('/onboarding/register')
        .send({
          hospitalName: 'General Hospital',
          adminEmail: 'admin@general.com',
          plan: 'enterprise',
          dataResidencyRegion: 'us-east-1',
        })
        .expect(201);

      expect(res.body.currentStep).toBe(OnboardingStep.REGISTRATION);
      expect(res.body.completionPercentage).toBe(25);
    });

    it('Step 2: POST /onboarding/:id/verify — advances to VERIFICATION step', async () => {
      const session = {
        id: sessionId,
        currentStep: OnboardingStep.REGISTRATION,
        status: OnboardingSessionStatus.ACTIVE,
        verificationToken,
        hospitalName: 'General Hospital',
        adminEmail: 'admin@general.com',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as OnboardingSession;

      sessionRepo.findOne.mockResolvedValue(session);
      sessionRepo.save.mockImplementation(async (s) => ({ ...s, currentStep: OnboardingStep.VERIFICATION }));

      const res = await request(app.getHttpServer())
        .post(`/onboarding/${sessionId}/verify`)
        .send({ token: verificationToken })
        .expect(201);

      expect(res.body.currentStep).toBe(OnboardingStep.VERIFICATION);
      expect(res.body.completionPercentage).toBe(50);
    });

    it('Step 3: POST /onboarding/:id/configure — advances to CONFIGURATION step', async () => {
      const session = {
        id: sessionId,
        currentStep: OnboardingStep.VERIFICATION,
        status: OnboardingSessionStatus.ACTIVE,
        verifiedAt: new Date(),
        hospitalName: 'General Hospital',
        adminEmail: 'admin@general.com',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as OnboardingSession;

      sessionRepo.findOne.mockResolvedValue(session);
      sessionRepo.save.mockImplementation(async (s) => ({ ...s, currentStep: OnboardingStep.CONFIGURATION }));

      const res = await request(app.getHttpServer())
        .post(`/onboarding/${sessionId}/configure`)
        .send({ timezone: 'America/New_York', locale: 'en-US' })
        .expect(201);

      expect(res.body.currentStep).toBe(OnboardingStep.CONFIGURATION);
      expect(res.body.completionPercentage).toBe(75);
    });

    it('GET /onboarding/:id/status — returns current step and completion percentage', async () => {
      const session = {
        id: sessionId,
        hospitalName: 'General Hospital',
        adminEmail: 'admin@general.com',
        currentStep: OnboardingStep.CONFIGURATION,
        status: OnboardingSessionStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as OnboardingSession;

      sessionRepo.findOne.mockResolvedValue(session);

      const res = await request(app.getHttpServer())
        .get(`/onboarding/${sessionId}/status`)
        .expect(200);

      expect(res.body.completionPercentage).toBe(75);
      expect(res.body.currentStep).toBe(OnboardingStep.CONFIGURATION);
    });

    it('rejects register with invalid payload (missing required fields)', async () => {
      await request(app.getHttpServer())
        .post('/onboarding/register')
        .send({ hospitalName: 'X' })
        .expect(400);
    });
  });
});
