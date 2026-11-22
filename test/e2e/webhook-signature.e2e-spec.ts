import {
  Body,
  Controller,
  Inject,
  Injectable,
  MiddlewareConsumer,
  Module,
  NestMiddleware,
  NestModule,
  Post,
  RequestMethod,
} from '@nestjs/common';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { createHmac } from 'crypto';
import request = require('supertest');
import { WebhookSignatureMiddleware } from '../../src/common/middleware/webhook-signature.middleware';

const WEBHOOK_SIGNATURE = 'WEBHOOK_SIGNATURE';
const WEBHOOK_SECRET_ENV = 'E2E_WEBHOOK_SECRET';
const WEBHOOK_SECRET = 'e2e-webhook-secret';

const redisMock = {
  set: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
};

@Controller('webhooks')
class TestWebhookController {
  @Post('ipfs')
  receive(@Body() body: Record<string, unknown>) {
    return body;
  }
}

@Injectable()
class TestWebhookSignatureMiddleware implements NestMiddleware {
  constructor(
    @Inject(WEBHOOK_SIGNATURE)
    private readonly signatureMiddleware: WebhookSignatureMiddleware,
  ) {}

  use(...args: Parameters<WebhookSignatureMiddleware['use']>) {
    return this.signatureMiddleware.use(...args);
  }
}

@Module({
  controllers: [TestWebhookController],
  providers: [
    TestWebhookSignatureMiddleware,
    {
      provide: WEBHOOK_SIGNATURE,
      useFactory: () => new WebhookSignatureMiddleware(WEBHOOK_SECRET_ENV, redisMock as any),
    },
  ],
})
class WebhookSignatureTestModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TestWebhookSignatureMiddleware)
      .forRoutes({ path: 'webhooks/ipfs', method: RequestMethod.POST });
  }
}

describe('Webhook signature (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env[WEBHOOK_SECRET_ENV] = WEBHOOK_SECRET;
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [WebhookSignatureTestModule],
    }).compile();

    app = moduleFixture.createNestApplication({ rawBody: true });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    delete process.env[WEBHOOK_SECRET_ENV];
  });

  it('rejects a one-byte body change with the same signature header', async () => {
    const originalBody = '{"event":"pin.added"}';
    const originalBodyBytes = Buffer.from(originalBody);
    const timestamp = Date.now();
    const nonce = 'e2e-nonce';
    const signature = createHmac('sha256', WEBHOOK_SECRET)
      .update(Buffer.concat([Buffer.from(`${timestamp}.${nonce}.`), originalBodyBytes]))
      .digest('hex');
    const header = `${timestamp}.${nonce}.${signature}`;
    const tamperedBody = Buffer.from(originalBodyBytes);
    tamperedBody[originalBodyBytes.indexOf('pin')] ^= 1;

    await request(app.getHttpServer())
      .post('/webhooks/ipfs')
      .set('Content-Type', 'application/json')
      .set('X-Webhook-Signature', header)
      .send(originalBody)
      .expect(201);

    await request(app.getHttpServer())
      .post('/webhooks/ipfs')
      .set('Content-Type', 'application/json')
      .set('X-Webhook-Signature', header)
      .send(tamperedBody.toString())
      .expect(401);
  });
});
