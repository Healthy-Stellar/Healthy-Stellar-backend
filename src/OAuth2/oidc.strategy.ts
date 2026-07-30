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
import { Request } from 'express';
import { OidcProviderConfig } from '../oidc.config';

export interface OidcVerifiedProfile {
  provider: string;
  providerSubject: string;
  email: string | null;
  givenName: string | null;
  familyName: string | null;
  rawClaims: Record<string, unknown>;
  tokenSet: TokenSet;
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

    // Retrieve and validate state from session
    const sessionState: string | undefined = (req.session as any)?.[`oidc_state_${providerName}`];
    const callbackParams: CallbackParamsType = client.callbackParams(req);

    if (!sessionState || callbackParams.state !== sessionState) {
      throw new UnauthorizedException('CSRF state mismatch');
    }

    let tokenSet: TokenSet;
    try {
      tokenSet = await client.callback(config.redirectUri, callbackParams, {
        state: sessionState,
        nonce: (req.session as any)?.[`oidc_nonce_${providerName}`],
      });
    } catch (err) {
      this.logger.error(`Token exchange failed for ${providerName}`, err);
      throw new UnauthorizedException('OIDC token exchange failed');
    }

    // Clean up session nonce/state
    delete (req.session as any)[`oidc_state_${providerName}`];
    delete (req.session as any)[`oidc_nonce_${providerName}`];

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

    const profile: OidcVerifiedProfile = {
      provider: providerName,
      providerSubject: userInfo.sub,
      email: (userInfo.email as string) ?? null,
      givenName: (userInfo.given_name as string) ?? null,
      familyName: (userInfo.family_name as string) ?? null,
      rawClaims: userInfo as Record<string, unknown>,
      tokenSet,
    };

    this.logger.log(
      `OIDC login success: provider=${providerName} sub=${userInfo.sub}`,
    );

    return profile;
  }
}

// ---------------------------------------------------------------------------
// Helper: generate authorization URL + state/nonce for initiation
// ---------------------------------------------------------------------------

export async function buildAuthorizationUrl(
  registry: OidcClientRegistry,
  providerName: string,
  session: Record<string, unknown>,
): Promise<string> {
  const client = await registry.getClient(providerName);
  const config = registry.getProviderConfig(providerName)!;

  const state = generators.state();
  const nonce = generators.nonce();
  const codeVerifier = generators.codeVerifier();
  const codeChallenge = generators.codeChallenge(codeVerifier);

  session[`oidc_state_${providerName}`] = state;
  session[`oidc_nonce_${providerName}`] = nonce;
  session[`oidc_verifier_${providerName}`] = codeVerifier;

  return client.authorizationUrl({
    scope: config.scope,
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });
}
