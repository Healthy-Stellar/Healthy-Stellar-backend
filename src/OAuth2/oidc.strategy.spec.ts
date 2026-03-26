import { UnauthorizedException } from '@nestjs/common';
import { OidcClientRegistry, OidcStrategy } from './oidc.strategy';
import { OidcProviderConfig } from './oidc.config';

// ---------------------------------------------------------------------------
// Minimal mocks for openid-client
// ---------------------------------------------------------------------------

const mockTokenSet = {
  claims: () => ({
    sub: 'sub-xyz',
    email: 'nurse@clinic.com',
    given_name: 'Florence',
    family_name: 'Nightingale',
  }),
};

const mockClient = {
  callbackParams: jest.fn(),
  callback: jest.fn(),
  userinfo: jest.fn(),
  authorizationUrl: jest.fn(),
};

jest.mock('openid-client', () => ({
  Issuer: {
    discover: jest.fn().mockResolvedValue({
      Client: jest.fn().mockImplementation(() => mockClient),
    }),
  },
  generators: {
    state: jest.fn().mockReturnValue('mock-state'),
    nonce: jest.fn().mockReturnValue('mock-nonce'),
    codeVerifier: jest.fn().mockReturnValue('mock-verifier'),
    codeChallenge: jest.fn().mockReturnValue('mock-challenge'),
  },
}));

// ---------------------------------------------------------------------------
// OidcClientRegistry tests
// ---------------------------------------------------------------------------

describe('OidcClientRegistry', () => {
  const azureConfig: OidcProviderConfig = {
    name: 'azure',
    issuer: 'https://login.microsoftonline.com/tenant/v2.0',
    clientId: 'client-id',
    clientSecret: 'client-secret',
    redirectUri: 'https://api.hospital.com/auth/oidc/azure/callback',
    scope: 'openid profile email',
  };

  let registry: OidcClientRegistry;

  beforeEach(() => {
    registry = new OidcClientRegistry([azureConfig]);
    (mockClient.callbackParams as jest.Mock).mockClear();
    (mockClient.callback as jest.Mock).mockClear();
    (mockClient.userinfo as jest.Mock).mockClear();
  });

  it('returns all provider names', () => {
    expect(registry.getAllProviderNames()).toEqual(['azure']);
  });

  it('returns the config for a known provider', () => {
    expect(registry.getProviderConfig('azure')).toEqual(azureConfig);
  });

  it('returns undefined for an unknown provider', () => {
    expect(registry.getProviderConfig('okta')).toBeUndefined();
  });

  it('builds and caches an openid-client for a known provider', async () => {
    const client1 = await registry.getClient('azure');
    const client2 = await registry.getClient('azure');
    expect(client1).toBe(client2); // same cached reference
  });

  it('throws UnauthorizedException for an unknown provider', async () => {
    await expect(registry.getClient('unknown')).rejects.toThrow(
      UnauthorizedException,
    );
  });
});

// ---------------------------------------------------------------------------
// OidcStrategy.validate tests
// ---------------------------------------------------------------------------

describe('OidcStrategy', () => {
  let strategy: OidcStrategy;
  let registry: OidcClientRegistry;

  const providerConfig: OidcProviderConfig = {
    name: 'azure',
    issuer: 'https://login.microsoftonline.com/tenant/v2.0',
    clientId: 'client-id',
    clientSecret: 'client-secret',
    redirectUri: 'https://api.hospital.com/auth/oidc/azure/callback',
    scope: 'openid profile email',
  };

  const buildRequest = (overrides: Record<string, unknown> = {}) =>
    ({
      params: { provider: 'azure' },
      session: {
        oidc_state_azure: 'mock-state',
        oidc_nonce_azure: 'mock-nonce',
      },
      query: {},
      ...overrides,
    } as any);

  beforeEach(async () => {
    registry = new OidcClientRegistry([providerConfig]);
    // Pre-build client so that discovery is not called again
    await registry.getClient('azure');

    strategy = new OidcStrategy(registry);
  });

  it('validates successfully and returns an OidcVerifiedProfile', async () => {
    mockClient.callbackParams.mockReturnValue({ code: 'auth-code', state: 'mock-state' });
    mockClient.callback.mockResolvedValue(mockTokenSet);
    mockClient.userinfo.mockResolvedValue({
      sub: 'sub-xyz',
      email: 'nurse@clinic.com',
      given_name: 'Florence',
      family_name: 'Nightingale',
    });

    const req = buildRequest();
    const profile = await strategy.validate(req);

    expect(profile.providerSubject).toBe('sub-xyz');
    expect(profile.email).toBe('nurse@clinic.com');
    expect(profile.givenName).toBe('Florence');
    expect(profile.provider).toBe('azure');
    // Session cleaned up
    expect(req.session.oidc_state_azure).toBeUndefined();
    expect(req.session.oidc_nonce_azure).toBeUndefined();
  });

  it('throws UnauthorizedException on CSRF state mismatch', async () => {
    mockClient.callbackParams.mockReturnValue({
      code: 'auth-code',
      state: 'tampered-state',
    });

    await expect(strategy.validate(buildRequest())).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('throws UnauthorizedException when provider is not in URL params', async () => {
    const req = buildRequest({ params: {} });
    await expect(strategy.validate(req)).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when token exchange fails', async () => {
    mockClient.callbackParams.mockReturnValue({ code: 'auth-code', state: 'mock-state' });
    mockClient.callback.mockRejectedValue(new Error('Bad token response'));

    await expect(strategy.validate(buildRequest())).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('falls back to id_token claims when userinfo call fails', async () => {
    mockClient.callbackParams.mockReturnValue({ code: 'auth-code', state: 'mock-state' });
    mockClient.callback.mockResolvedValue(mockTokenSet);
    mockClient.userinfo.mockRejectedValue(new Error('userinfo 503'));

    const profile = await strategy.validate(buildRequest());

    // Should still have a subject from claims()
    expect(profile.providerSubject).toBe('sub-xyz');
  });

  it('throws UnauthorizedException when subject claim is missing', async () => {
    mockClient.callbackParams.mockReturnValue({ code: 'auth-code', state: 'mock-state' });
    mockClient.callback.mockResolvedValue({
      claims: () => ({}),
    });
    mockClient.userinfo.mockResolvedValue({ sub: undefined });

    await expect(strategy.validate(buildRequest())).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
