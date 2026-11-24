import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { OidcController } from './oidc.controller';
import { OidcService } from './oidc.service';

describe('OidcController redirectTo validation', () => {
  let controller: OidcController;
  let oidcService: { getAuthorizationUrl: jest.Mock; handleCallback: jest.Mock };

  const makeRes = () => ({ redirect: jest.fn() });

  beforeEach(async () => {
    oidcService = {
      getAuthorizationUrl: jest.fn().mockResolvedValue('https://idp.example/auth'),
      handleCallback: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OidcController],
      providers: [{ provide: OidcService, useValue: oidcService }],
    }).compile();

    controller = module.get<OidcController>(OidcController);
  });

  afterEach(() => {
    delete process.env.OIDC_ALLOWED_REDIRECT_ORIGINS;
  });

  it('allows relative paths', async () => {
    const res = makeRes();
    await controller.loginGet('google', { redirectTo: '/dashboard' }, res as any);
    expect(oidcService.getAuthorizationUrl).toHaveBeenCalledWith(
      'google',
      '/dashboard',
    );
    expect(res.redirect).toHaveBeenCalledWith('https://idp.example/auth');
  });

  it('rejects external URLs not in the allowlist', async () => {
    const res = makeRes();
    await expect(
      controller.loginGet(
        'google',
        { redirectTo: 'https://attacker.example/steal' },
        res as any,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(oidcService.getAuthorizationUrl).not.toHaveBeenCalled();
  });

  it('rejects protocol-relative //evil URLs', async () => {
    const res = makeRes();
    await expect(
      controller.loginGet('google', { redirectTo: '//evil.example' }, res as any),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(oidcService.getAuthorizationUrl).not.toHaveBeenCalled();
  });

  it('allows absolute URLs from the configured allowlist', async () => {
    process.env.OIDC_ALLOWED_REDIRECT_ORIGINS = 'https://app.healthystellar.com';
    const res = makeRes();
    await controller.loginGet(
      'google',
      { redirectTo: 'https://app.healthystellar.com/dashboard' },
      res as any,
    );
    expect(oidcService.getAuthorizationUrl).toHaveBeenCalledWith(
      'google',
      'https://app.healthystellar.com/dashboard',
    );
  });

  it('rejects external URLs even when an allowlist is configured', async () => {
    process.env.OIDC_ALLOWED_REDIRECT_ORIGINS = 'https://app.healthystellar.com';
    const res = makeRes();
    await expect(
      controller.loginGet(
        'google',
        { redirectTo: 'https://attacker.example' },
        res as any,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('redirects with a one-time code instead of the access token', async () => {
    oidcService.handleCallback.mockResolvedValue({
      accessToken: 'secret-token',
      redirectTo: '/dashboard',
    });
    const res = makeRes();
    await controller.callbackGet('google', 'code', 'state', res as any);
    const target = res.redirect.mock.calls[0][0] as string;
    expect(target).not.toContain('secret-token');
    expect(target).toContain('oidc_code=');
  });

  it('exchanges a one-time code for the access token', async () => {
    oidcService.handleCallback.mockResolvedValue({
      accessToken: 'secret-token',
      redirectTo: '/dashboard',
    });
    const res = makeRes();
    await controller.callbackGet('google', 'code', 'state', res as any);
    const target = res.redirect.mock.calls[0][0] as string;
    const oneTimeCode = new URL(target, 'http://localhost').searchParams.get(
      'oidc_code',
    ) as string;

    const result = await controller.exchangeCode({ code: oneTimeCode });
    expect(result).toEqual({ accessToken: 'secret-token' });

    await expect(
      controller.exchangeCode({ code: oneTimeCode }),
    ).rejects.toBeInstanceOf(Error);
  });
});
