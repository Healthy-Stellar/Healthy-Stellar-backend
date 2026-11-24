import { BadRequestException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';
import type { Redis } from 'ioredis';

/** DI token for the shared ioredis client used by the OAuth2 module. */
export const OAUTH2_REDIS = 'OAUTH2_REDIS';

/**
 * Redis-backed store for authorization codes.
 * Codes live under `oauth2:code:<code>` with a 60 s TTL and are consumed
 * atomically via GETDEL so they can only be redeemed once, even across
 * multiple API replicas.
 */
interface AuthCodeEntry {
  clientId: string;
  redirectUri: string;
  userId: string;
  scope: string;
  codeChallenge?: string;
  codeChallengeMethod?: 'S256';
  expiresAt: number;
  /** SMART on FHIR: launch context token from EHR */
  launch?: string;
}

@Injectable()
export class PkceService {
  /** Authorization code TTL in seconds (Redis EX). */
  private readonly CODE_TTL_SECONDS = 60;
  private readonly KEY_PREFIX = 'oauth2:code:';

  constructor(@Inject(OAUTH2_REDIS) private readonly redis: Redis) {}

  // ---------------------------------------------------------------------------
  // Authorization code lifecycle
  // ---------------------------------------------------------------------------

  async issueCode(
    clientId: string,
    redirectUri: string,
    userId: string,
    scope: string,
    codeChallenge?: string,
    codeChallengeMethod?: 'S256',
    launch?: string,
  ): Promise<string> {
    const code = crypto.randomBytes(32).toString('base64url');
    const entry: AuthCodeEntry = {
      clientId,
      redirectUri,
      userId,
      scope,
      codeChallenge,
      codeChallengeMethod,
      expiresAt: Date.now() + this.CODE_TTL_SECONDS * 1000,
      launch,
    };
    await this.redis.set(
      this.KEY_PREFIX + code,
      JSON.stringify(entry),
      'EX',
      this.CODE_TTL_SECONDS,
    );
    return code;
  }

  /**
   * Consume and validate an authorization code.
   * Throws on any mismatch so callers can return 400.
   */
  async consumeCode(
    code: string,
    clientId: string,
    redirectUri: string,
    codeVerifier?: string,
  ): Promise<AuthCodeEntry> {
    // Atomic get-and-delete: a code can only ever be redeemed once.
    const raw = await this.redis.getdel(this.KEY_PREFIX + code);

    if (!raw) {
      throw new BadRequestException('invalid_grant: authorization code expired or not found');
    }

    let entry: AuthCodeEntry;
    try {
      entry = JSON.parse(raw) as AuthCodeEntry;
    } catch {
      throw new BadRequestException('invalid_grant: authorization code expired or not found');
    }

    if (Date.now() > entry.expiresAt) {
      throw new BadRequestException('invalid_grant: authorization code expired or not found');
    }

    if (entry.clientId !== clientId || entry.redirectUri !== redirectUri) {
      throw new BadRequestException('invalid_grant: client_id or redirect_uri mismatch');
    }

    if (entry.codeChallenge) {
      // PKCE was required for this code — verifier is mandatory
      if (!codeVerifier) {
        throw new UnauthorizedException('invalid_grant: code_verifier required');
      }
      if (!this.verifyChallenge(codeVerifier, entry.codeChallenge)) {
        throw new UnauthorizedException('invalid_grant: code_verifier does not match code_challenge');
      }
    }

    return entry;
  }

  // ---------------------------------------------------------------------------
  // PKCE S256 verification
  // ---------------------------------------------------------------------------

  /** BASE64URL(SHA256(ASCII(code_verifier))) === stored code_challenge */
  verifyChallenge(verifier: string, challenge: string): boolean {
    const computed = crypto
      .createHash('sha256')
      .update(verifier)
      .digest('base64url');
    return computed === challenge;
  }
}
