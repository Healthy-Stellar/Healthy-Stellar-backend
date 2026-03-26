export interface OidcProviderConfig {
  name: string;
  issuer: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string;
  /** Optional: skip discovery and provide endpoints directly */
  authorizationUrl?: string;
  tokenUrl?: string;
  userInfoUrl?: string;
  jwksUri?: string;
}

export interface OidcModuleConfig {
  providers: OidcProviderConfig[];
  /** JWT secret used to sign issued tokens */
  jwtSecret: string;
  jwtExpiresIn: string;
}

/**
 * Build OIDC provider configs from environment variables.
 *
 * Convention (supports N providers):
 *   OIDC_PROVIDERS=azure,okta
 *
 *   OIDC_AZURE_ISSUER=https://login.microsoftonline.com/{tenant}/v2.0
 *   OIDC_AZURE_CLIENT_ID=...
 *   OIDC_AZURE_CLIENT_SECRET=...
 *   OIDC_AZURE_REDIRECT_URI=https://api.hospital.com/auth/oidc/azure/callback
 *   OIDC_AZURE_SCOPE=openid profile email          # optional, defaults shown
 *
 *   OIDC_OKTA_ISSUER=https://hospital.okta.com/oauth2/default
 *   OIDC_OKTA_CLIENT_ID=...
 *   ... (same pattern)
 */
export function buildOidcConfig(): OidcModuleConfig {
  const rawProviders = process.env.OIDC_PROVIDERS ?? '';
  const providerNames = rawProviders
    .split(',')
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);

  const providers: OidcProviderConfig[] = providerNames.map((name) => {
    const prefix = `OIDC_${name.toUpperCase()}`;
    const issuer = requireEnv(`${prefix}_ISSUER`);
    const clientId = requireEnv(`${prefix}_CLIENT_ID`);
    const clientSecret = requireEnv(`${prefix}_CLIENT_SECRET`);
    const redirectUri = requireEnv(`${prefix}_REDIRECT_URI`);
    const scope = process.env[`${prefix}_SCOPE`] ?? 'openid profile email';

    return {
      name,
      issuer,
      clientId,
      clientSecret,
      redirectUri,
      scope,
      authorizationUrl: process.env[`${prefix}_AUTHORIZATION_URL`],
      tokenUrl: process.env[`${prefix}_TOKEN_URL`],
      userInfoUrl: process.env[`${prefix}_USERINFO_URL`],
      jwksUri: process.env[`${prefix}_JWKS_URI`],
    };
  });

  return {
    providers,
    jwtSecret: requireEnv('JWT_SECRET'),
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '8h',
  };
}

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}
