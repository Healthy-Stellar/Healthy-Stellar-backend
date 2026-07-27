import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  VersioningType,
  Controller,
  Get,
  Logger,
  Version,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as request from 'supertest';
import { DeprecationInterceptor } from '../common/interceptors/deprecation.interceptor';
import { DeprecatedRoute } from '../common/decorators/deprecated.decorator';
import { ApiVersionLifecycleInterceptor } from './api-version-lifecycle.interceptor';
import { ApiVersionLifecyclePolicy } from './api-version-lifecycle.policy';

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
    sunsetDate: 'Wed, 01 Jan 2030 00:00:00 GMT',
    alternativeRoute: '/v2/test-v1/deprecated',
  })
  getDeprecated() {
    return { version: 1, deprecated: true };
  }

  @Version('1')
  @Get('deprecated-gone')
  @DeprecatedRoute({
    sunsetDate: 'Wed, 01 Jan 2020 00:00:00 GMT',
    alternativeRoute: '/v2/test-v1/deprecated-gone',
    reason: 'This endpoint has been removed.',
  })
  getDeprecatedGone() {
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

@Controller('test-v1')
class TestV3Controller {
  @Version('3')
  @Get()
  getV3() {
    return { version: 3 };
  }
}

@Controller('test-v4')
class TestV4Controller {
  @Version('4')
  @Get()
  getV4() {
    return { version: 4 };
  }
}

@Controller('test-v5')
class TestV5Controller {
  @Version('5')
  @Get()
  getV5() {
    return { version: 5 };
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

@Controller('test-legacy')
class TestLegacyController {
  @Get()
  getLegacy() {
    return { legacy: true };
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('API Versioning (routing)', () => {
  let app: INestApplication;
  let httpApp: any;
  const now = () => new Date('2026-04-25T00:00:00.000Z');
  const policies: ApiVersionLifecyclePolicy[] = [
    {
      version: '1',
      status: 'current',
      releaseDate: '2024-01-01',
      baseUrl: '/v1',
    },
    {
      version: '2',
      status: 'deprecated',
      releaseDate: '2025-01-01',
      baseUrl: '/v2',
      sunsetDate: 'Wed, 01 Jan 2030 00:00:00 GMT',
      replacementVersion: '1',
    },
    {
      version: '3',
      status: 'sunset',
      releaseDate: '2023-01-01',
      baseUrl: '/v3',
      sunsetDate: 'Wed, 01 Jan 2025 00:00:00 GMT',
      replacementVersion: '1',
    },
    {
      version: '5',
      status: 'deprecated',
      releaseDate: '2023-01-01',
      baseUrl: '/v5',
      sunsetDate: 'Wed, 01 Jan 2025 00:00:00 GMT',
      replacementVersion: '1',
    },
  ];

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [
        TestV1Controller,
        TestV2Controller,
        TestV3Controller,
        TestV4Controller,
        TestV5Controller,
        TestNeutralController,
        TestLegacyController,
      ],
    }).compile();

    app = module.createNestApplication();

    app.enableVersioning({ type: VersioningType.URI, defaultVersion: ['1', VERSION_NEUTRAL] });
    app.useGlobalInterceptors(new ApiVersionLifecycleInterceptor(policies, now));
    app.useGlobalInterceptors(new DeprecationInterceptor(app.get(Reflector)));

    await app.init();
    httpApp = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /v1/test-v1 routes to v1 controller', async () => {
    const res = await request(httpApp).get('/v1/test-v1').expect(200);
    expect(res.body.version).toBe(1);
    expect(res.headers['api-version']).toBe('v1');
    expect(res.headers['api-version-status']).toBe('current');
  });

  it('GET /v2/test-v1 routes to v2 controller', async () => {
    const res = await request(httpApp).get('/v2/test-v1').expect(200);
    expect(res.body.version).toBe(2);
  });

  it('deprecated version returns RFC 8594 deprecation headers', async () => {
    const res = await request(httpApp).get('/v2/test-v1').expect(200);
    expect(res.headers['api-version']).toBe('v2');
    expect(res.headers['api-version-status']).toBe('deprecated');
    expect(res.headers['deprecation']).toBe('Wed, 01 Jan 2030 00:00:00 GMT');
    expect(res.headers['sunset']).toBe('Wed, 01 Jan 2030 00:00:00 GMT');
    expect(res.headers['link']).toContain('rel="help"');
    expect(res.headers['link']).toContain('/v1');
  });

  it('deprecated version logs a server-side warning', async () => {
    const loggerWarnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    await request(httpApp).get('/v2/test-v1').expect(200);
    expect(loggerWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Deprecated API version v2 called'),
    );
    loggerWarnSpy.mockRestore();
  });

  it('sunset version returns 410 Gone', async () => {
    const res = await request(httpApp).get('/v3/test-v1').expect(410);
    expect(String(res.body.message)).toContain('API version v3 is no longer available');
  });

  it('deprecated version returns 410 Gone after its sunset date', async () => {
    const res = await request(httpApp).get('/v5/test-v5').expect(410);
    expect(String(res.body.message)).toContain('API version v5 is no longer available');
  });

  it('unversioned legacy route is still governed by the default v1 lifecycle policy', async () => {
    const res = await request(httpApp).get('/test-legacy').expect(200);
    expect(res.body.legacy).toBe(true);
    expect(res.headers['api-version']).toBe('v1');
    expect(res.headers['api-version-status']).toBe('current');
  });

  it('fails closed when a routed API version is missing lifecycle policy', async () => {
    const res = await request(httpApp).get('/v4/test-v4').expect(500);
    expect(String(res.body.message)).toContain(
      'API version v4 is not registered in the lifecycle policy',
    );
  });

  it('VERSION_NEUTRAL controller responds without version prefix', async () => {
    const res = await request(httpApp).get('/test-neutral').expect(200);
    expect(res.body.neutral).toBe(true);
    expect(res.headers['api-version']).toBeUndefined();
  });

  it('deprecated endpoint returns Deprecation header', async () => {
    const res = await request(httpApp).get('/v1/test-v1/deprecated').expect(200);
    expect(res.headers['deprecation']).toBe('true');
  });

  it('deprecated endpoint returns Sunset header', async () => {
    const res = await request(httpApp).get('/v1/test-v1/deprecated').expect(200);
    expect(res.headers['sunset']).toBe('Wed, 01 Jan 2030 00:00:00 GMT');
  });

  it('deprecated endpoint returns Link header pointing to alternative', async () => {
    const res = await request(httpApp).get('/v1/test-v1/deprecated').expect(200);
    expect(res.headers['link']).toContain('/v2/test-v1/deprecated');
  });

  it('route-level sunset endpoint returns 410 Gone', async () => {
    const res = await request(httpApp).get('/v1/test-v1/deprecated-gone').expect(410);
    expect(String(res.body.message)).toContain('This endpoint is no longer available');
  });

  it('non-deprecated endpoint does NOT return Deprecation header', async () => {
    const res = await request(httpApp).get('/v1/test-v1').expect(200);
    expect(res.headers['deprecation']).toBeUndefined();
  });
});
