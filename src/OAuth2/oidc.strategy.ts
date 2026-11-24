import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import {
  BaseClient,
  CallbackParamsType,
  generators,
  Issuer,
  TokenSet,
  UserinfoResponse,
} from 'openid-client';
import { Strategy } from 'passport-custom';
import { Request, Response } from 'express';
import { OidcProviderConfig } from '../oidc.config';

export interface OidcVerifiedProfile {
  provider: string;
  providerSubject: string;
  email: string | null;
  emailVerified: boolean;
  givenName: string | null;
  familyName: string | null;
  rawClaims: Record<string, unknown>;
  tokenSet: TokenSet;
}

/**
 * Name of the short-lived, signed, HttpOnly cookie used to carry the OIDC
 * state/nonce/PKCE verifier between the authorization redirect and the
 * callback. We deliberately avoid a server-side session (no express-session
 * is installed) and instead persist the transient values in a cookie that is
 * scoped to the callback path and expires quickly.
 */
export const OIDC_STATE_COOKIE = 'oidc_state';

/** Lifetime of the transient OIDC state cookie (10 minutes). */
export const OIDC_STATE_COOKIE_MAX_AGE_MS = 10 * 60 * 1000;

export interface OidcStateCookiePayload {
  provider: string;
  state: string;
  nonce: string;
  codeVerifier: string;
  redirect?: string;
}

/**
 * Registry that holds one openid-client `Client` per configured provider.
 * Clients are built lazily via OIDC discovery so that missing/offline
 * providers don't crash startup.
 */
@Injectable()
export class OidcClientRegistry {
  private readonly logger = new Logger(OidcClientRegistry.name);
  private readonly clients = new Map<string, BaseClient>();

  constructor(private readonly providerConfigs: OidcProviderConfig[]) {}

  async getClient(providerName: string): Promise<BaseClient> {
    const cached = this.clients.get(providerName);
    if (cached) return cached;

    const config = this.providerConfigs.find((p) => p.name === providerName);
    if (!config) {
      throw new UnauthorizedException(`Unknown OIDC provider: ${providerName}`);
    }

    return this.buildClient(config);
  }

  private async buildClient(config: OidcProviderConfig): Promise<BaseClient> {
    let issuer: Issuer<BaseClient>;

    if (
      config.authorizationUrl &&
      config.tokenUrl &&
      config.jwksUri
    ) {
      // Manual endpoint configuration — no discovery needed
      this.logger.log(
        `Building OIDC client for "${config.name}" from explicit endpoints`,
      );
      issuer = new Issuer({
        issuer: config.issuer,
        authorization_endpoint: config.authorizationUrl,
        token_endpoint: config.tokenUrl,
        userinfo_endpoint: config.userInfoUrl,
        jwks_uri: config.jwksUri,
      });
    } else {
      // Auto-discovery via /.well-known/openid-configuration
      this.logger.log(
        `Discovering OIDC metadata for "${config.name}" at ${config.issuer}`,
      );
      issuer = await Issuer.discover(config.issuer);
    }

    const client = new issuer.Client({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uris: [config.redirectUri],
      response_types: ['code'],
    });

    this.clients.set(config.name, client);
    this.logger.log(`OIDC client for "${config.name}" ready`);
    return client;
  }

  getProviderConfig(name: string): OidcProviderConfig | undefined {
    return this.providerConfigs.find((p) => p.name === name);
  }

  getAllProviderNames(): string[] {
    return this.providerConfigs.map((p) => p.name);
  }
}

// ---------------------------------------------------------------------------
// Passport strategy (custom, provider-agnostic)
// ---------------------------------------------------------------------------

/**
 * A single Passport strategy that handles callbacks for ANY configured
 * OIDC provider. The active provider is read from `req.params.provider`.
 *
 * Register as: PassportStrategy(Strategy, 'oidc')
 */
@Injectable()
export class OidcStrategy extends PassportStrategy(Strategy, 'oidc') {
  private readonly logger = new Logger(OidcStrategy.name);

  constructor(private readonly registry: OidcClientRegistry) {
    super();
  }

  async validate(req: Request): Promise<OidcVerifiedProfile> {
    const providerName = (req.params as Record<string, string>).provider;
    if (!providerName) {
      throw new UnauthorizedException('Provider not specified in URL');
    }

    const client = await this.registry.getClient(providerName);
    const config = this.registry.getProviderConfig(providerName)!;

    // Retrieve the transient state/nonce/verifier from the signed cookie set
    // during initiation. No server-side session is required.
    const cookiePayload = readOidcStateCookie(req);
    const callbackParams: CallbackParamsType = client.callbackParams(req);

    if (
      !cookiePayload ||
      cookiePayload.provider !== providerName ||
      !cookiePayload.state ||
      callbackParams.state !== cookiePayload.state
    ) {
      throw new UnauthorizedException('CSRF state mismatch');
    }

    let tokenSet: TokenSet;
    try {
      tokenSet = await client.callback(config.redirectUri, callbackParams, {
        state: cookiePayload.state,
        nonce: cookiePayload.nonce,
        code_verifier: cookiePayload.codeVerifier,
      });
    } catch (err) {
      this.logger.error(`Token exchange failed for ${providerName}`, err);
      throw new UnauthorizedException('OIDC token exchange failed');
    }

    // Clear the transient state cookie now that the exchange succeeded.
    clearOidcStateCookie(req);

    let userInfo: UserinfoResponse;
    try {
      userInfo = await client.userinfo(tokenSet);
    } catch (err) {
      this.logger.warn(`Userinfo call failed, falling back to id_token claims`);
      userInfo = tokenSet.claims() as UserinfoResponse;
    }

    if (!userInfo.sub) {
      throw new UnauthorizedException('OIDC userinfo missing subject claim');
    }

    // Capture the email_verified claim so downstream account-linking logic can
    // refuse to auto-link an OIDC identity to an existing account by email
    // unless the IdP has actually verified ownership of that address.
    const emailVerified = userInfo.email_verified === true;

    const profile: OidcVerifiedProfile = {
      provider: providerName,
      providerSubject: userInfo.sub,
      email: (userInfo.email as string) ?? null,
      emailVerified,
      givenName: (userInfo.given_name as string) ?? null,
      familyName: (userInfo.family_name as string) ?? null,
      rawClaims: userInfo as Record<string, unknown>,
      tokenSet,
    };

    this.logger.log(
      `OIDC login success: provider=${providerName} sub=${userInfo.sub} emailVerified=${emailVerified}`,
    );

    return profile;
  }
}

// ---------------------------------------------------------------------------
// Helper: generate authorization URL + state/nonce for initiation
// ---------------------------------------------------------------------------

/**
 * Build the provider authorization URL and persist the transient state/nonce/
 * PKCE verifier in a signed, HttpOnly, SameSite=Lax, short-lived cookie on the
 * response. This replaces the previous (broken) reliance on `req.session`.
 */
export async function buildAuthorizationUrl(
  registry: OidcClientRegistry,
  providerName: string,
  res: Response,
  redirect?: string,
): Promise<string> {
  const client = await registry.getClient(providerName);
  const config = registry.getProviderConfig(providerName)!;

  const state = generators.state();
  const nonce = generators.nonce();
  const codeVerifier = generators.codeVerifier();
  const codeChallenge = generators.codeChallenge(codeVerifier);

  const payload: OidcStateCookiePayload = {
    provider: providerName,
    state,
    nonce,
    codeVerifier,
    ...(redirect ? { redirect } : {}),
  };

  writeOidcStateCookie(res, payload);

  return client.authorizationUrl({
    scope: config.scope,
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });
}

// ---------------------------------------------------------------------------
// Cookie helpers for the transient OIDC state
// ---------------------------------------------------------------------------

function writeOidcStateCookie(res: Response, payload: OidcStateCookiePayload): void {
  const value = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  res.cookie(OIDC_STATE_COOKIE, value, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    signed: true,
    path: '/',
    maxAge: OIDC_STATE_COOKIE_MAX_AGE_MS,
  });
}

function readOidcStateCookie(req: Request): OidcStateCookiePayload | null {
  const raw = (req as Request & { signedCookies?: Record<string, string> })
    .signedCookies?.[OIDC_STATE_COOKIE];
  if (!raw) return null;
  try {
    const decoded = Buffer.from(raw, 'base64url').toString('utf8');
    const parsed = JSON.parse(decoded) as OidcStateCookiePayload;
    if (!parsed || typeof parsed.state !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

function clearOidcStateCookie(req: Request): void {
  const res = (req as Request & { res?: Response }).res;
  if (res && typeof res.clearCookie === 'function') {
    res.clearCookie(OIDC_STATE_COOKIE, { path: '/' });
  }
}
