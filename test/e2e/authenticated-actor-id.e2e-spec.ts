import { CanActivate, ExecutionContext, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ClaimService } from '../../src/billing/services/claim.service';
import { UserRole } from '../../src/auth/entities/user.entity';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../src/auth/guards/roles.guard';
import { JwtPayload } from '../../src/auth/services/auth-token.service';
import { IpfsService } from '../../src/stellar/services/ipfs.service';
import { QueueService } from '../../src/queues/queue.service';
import { ConfigService } from '@nestjs/config';
import { LabTestsController } from '../../src/laboratory/controllers/lab-tests.controller';
import { LabTestsService } from '../../src/laboratory/services/lab-tests.service';
import { WebhookDelivery } from '../../src/webhooks/entities/webhook-delivery.entity';
import { WebhookDeliveryService } from '../../src/webhooks/services/webhook-delivery.service';
import { WebhookSubscriptionService } from '../../src/webhooks/services/webhook-subscription.service';
import { WebhooksController } from '../../src/webhooks/webhooks.controller';
jest.mock('../../src/laboratory/services/lab-tests.service', () => ({
  LabTestsService: class LabTestsService {},
}));
import type { CreateLabTestDto } from '../../src/laboratory/dto/create-lab-test.dto';
import type { CreateWebhookSubscriptionDto } from '../../src/webhooks/dto/webhook-subscription.dto';

jest.mock('../../src/billing/services/claim.service', () => ({
  ClaimService: class ClaimService {},
}));
jest.mock('../../src/billing/dto/claim.dto', () => ({
  AdjudicationWebhookDto: class AdjudicationWebhookDto {},
}));
jest.mock('../../src/queues/queue.service', () => ({
  QueueService: class QueueService {},
}));
jest.mock('../../src/webhooks/services/webhook-delivery.service', () => ({
  WebhookDeliveryService: class WebhookDeliveryService {},
}));
jest.mock('../../src/webhooks/services/webhook-subscription.service', () => ({
  WebhookSubscriptionService: class WebhookSubscriptionService {},
}));

const authenticatedUser: JwtPayload = {
  userId: 'd94d3b84-1d62-40c8-8525-cb58f99055d6',
  email: 'actor@example.test',
  role: UserRole.ADMIN,
  mfaEnabled: true,
  sessionId: 'test-session',
  organizationId: 'a7e4fdf2-74b7-4e51-9bc5-bbb8e227ecdd',
};

class TestJwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    context.switchToHttp().getRequest<{ user?: JwtPayload }>().user = authenticatedUser;
    return true;
  }
}

describe('Authenticated actor ID e2e', () => {
  let app: INestApplication;
  const savedSubscriptions: Array<Record<string, unknown>> = [];
  const savedLabTests: Array<Record<string, unknown>> = [];

  beforeAll(async () => {
    const subscriptionService = {
      assertEventsAllowedForRole: jest.fn(),
      createSubscription: jest.fn(
        (tenantId: string, userId: string, dto: CreateWebhookSubscriptionDto) => {
          const saved = { ...dto, tenantId, userId };
          savedSubscriptions.push(saved);
          return saved;
        },
      ),
    };
    const labTestsService = {
      create: jest.fn((dto: CreateLabTestDto, userId: string) => {
        const saved = { ...dto, createdBy: userId, updatedBy: userId };
        savedLabTests.push(saved);
        return saved;
      }),
    };

    const moduleBuilder = Test.createTestingModule({
      controllers: [WebhooksController, LabTestsController],
      providers: [
        { provide: IpfsService, useValue: {} },
        { provide: QueueService, useValue: {} },
        { provide: ConfigService, useValue: {} },
        { provide: WebhookDeliveryService, useValue: {} },
        { provide: WebhookSubscriptionService, useValue: subscriptionService },
        { provide: LabTestsService, useValue: labTestsService },
        { provide: ClaimService, useValue: {} },
        { provide: getRepositoryToken(WebhookDelivery), useValue: {} },
      ],
    });
    const moduleFixture: TestingModule = await moduleBuilder
      .overrideGuard(JwtAuthGuard)
      .useClass(TestJwtAuthGuard)
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    app = moduleFixture.createNestApplication();
    app.use((req: { user?: JwtPayload }, _res: unknown, next: () => void) => {
      req.user = authenticatedUser;
      next();
    });
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  beforeEach(() => {
    savedSubscriptions.length = 0;
    savedLabTests.length = 0;
  });

  it('stores the JWT actor ID on webhook subscriptions', async () => {
    await request(app.getHttpServer())
      .post('/webhooks/subscriptions')
      .send({ url: 'https://subscriber.example.test/hook', events: ['patient.created'] })
      .expect(201);

    expect(savedSubscriptions).toHaveLength(1);
    expect(savedSubscriptions[0].userId).toBe(authenticatedUser.userId);
  });

  it('stores the JWT actor ID on lab tests', async () => {
    await request(app.getHttpServer())
      .post('/laboratory/tests')
      .send({
        testCode: 'CBC',
        testName: 'Complete blood count',
        category: 'hematology',
        specimenType: 'blood',
        turnaroundTime: 60,
        cost: 25,
      })
      .expect(201);

    expect(savedLabTests).toHaveLength(1);
    expect(savedLabTests[0].createdBy).toBe(authenticatedUser.userId);
  });
});
