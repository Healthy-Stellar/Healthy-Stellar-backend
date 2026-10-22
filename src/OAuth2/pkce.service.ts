import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';

/**
 * In-memory store for authorization codes.
 * In production, swap for Redis with TTL.
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
  private readonly codes = new Map<string, AuthCodeEntry>();
  /** 10-minute code TTL */
  private readonly CODE_TTL_MS = 10 * 60 * 1000;

  // ---------------------------------------------------------------------------
  // Authorization code lifecycle
  // ---------------------------------------------------------------------------

  issueCode(
    clientId: string,
    redirectUri: string,
    userId: string,
    scope: string,
    codeChallenge?: string,
    codeChallengeMethod?: 'S256',
    launch?: string,
  ): string {
    const code = crypto.randomBytes(32).toString('base64url');
    this.codes.set(code, {
      clientId,
      redirectUri,
      userId,
      scope,
      codeChallenge,
      codeChallengeMethod,
      expiresAt: Date.now() + this.CODE_TTL_MS,
      launch,
    });
    return code;
  }

  /**
   * Consume and validate an authorization code.
   * Throws on any mismatch so callers can return 400.
   */
  consumeCode(
    code: string,
    clientId: string,
    redirectUri: string,
    codeVerifier?: string,
  ): AuthCodeEntry {
    const entry = this.codes.get(code);
    this.codes.delete(code); // one-time use

    if (!entry || Date.now() > entry.expiresAt) {
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
