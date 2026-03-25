import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, VersioningType, Controller, Get, Version, VERSION_NEUTRAL } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as request from 'supertest';
import { DeprecationInterceptor } from '../common/interceptors/deprecation.interceptor';
import { DeprecatedRoute } from '../common/decorators/deprecated.decorator';

// ── Minimal test controllers ──────────────────────────────────────────────────

@Controller('test-v1')
class TestV1Controller {
  @Version('1')
  @Get()
  getV1() {
    return { version: 1 };
  }

  @Version('1')
  @Get('deprecated')
  @DeprecatedRoute({
    sunsetDate: 'Wed, 01 Jan 2026 00:00:00 GMT',
    alternativeRoute: '/v2/test-v1/deprecated',
  })
  getDeprecated() {
    return { version: 1, deprecated: true };
  }
}

@Controller('test-v1')
class TestV2Controller {
  @Version('2')
  @Get()
  getV2() {
    return { version: 2 };
  }
}

@Controller('test-neutral')
class TestNeutralController {
  @Version(VERSION_NEUTRAL)
  @Get()
  getNeutral() {
    return { neutral: true };
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('API Versioning (routing)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TestV1Controller, TestV2Controller, TestNeutralController],
    }).compile();

    app = module.createNestApplication();

    app.enableVersioning({ type: VersioningType.URI });
    app.useGlobalInterceptors(new DeprecationInterceptor(app.get(Reflector)));

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /v1/test-v1 routes to v1 controller', async () => {
    const res = await request(app.getHttpServer()).get('/v1/test-v1').expect(200);
    expect(res.body.version).toBe(1);
  });

  it('GET /v2/test-v1 routes to v2 controller', async () => {
    const res = await request(app.getHttpServer()).get('/v2/test-v1').expect(200);
    expect(res.body.version).toBe(2);
  });

  it('VERSION_NEUTRAL controller responds without version prefix', async () => {
    const res = await request(app.getHttpServer()).get('/test-neutral').expect(200);
    expect(res.body.neutral).toBe(true);
  });

  it('deprecated endpoint returns Deprecation header', async () => {
    const res = await request(app.getHttpServer()).get('/v1/test-v1/deprecated').expect(200);
    expect(res.headers['deprecation']).toBe('true');
  });

  it('deprecated endpoint returns Sunset header', async () => {
    const res = await request(app.getHttpServer()).get('/v1/test-v1/deprecated').expect(200);
    expect(res.headers['sunset']).toBe('Wed, 01 Jan 2026 00:00:00 GMT');
  });

  it('deprecated endpoint returns Link header pointing to alternative', async () => {
    const res = await request(app.getHttpServer()).get('/v1/test-v1/deprecated').expect(200);
    expect(res.headers['link']).toContain('/v2/test-v1/deprecated');
  });

  it('non-deprecated endpoint does NOT return Deprecation header', async () => {
    const res = await request(app.getHttpServer()).get('/v1/test-v1').expect(200);
    expect(res.headers['deprecation']).toBeUndefined();
  });
});
