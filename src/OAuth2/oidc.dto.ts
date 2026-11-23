import { IsOptional, IsString, Length, Matches } from 'class-validator';

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

/**
 * Body accepted by POST /auth/oidc/:provider/callback
 * when the IdP does a back-channel / front-channel POST redirect.
 */
export class OidcCallbackDto {
  @IsString()
  code: string;

  @IsString()
  state: string;
}

/**
 * Body for POST /auth/oidc/link — allows an already-authenticated user
 * (via Stellar JWT) to link their account to an OIDC identity.
 */
export class LinkOidcIdentityDto {
  @IsString()
  provider: string;

  @IsString()
  code: string;

  @IsString()
  state: string;
}

/**
 * Body for POST /auth/oidc/link-stellar — called after OIDC login to bind
 * a Stellar address to the OIDC-authenticated user.
 */
export class LinkStellarAddressDto {
  /** The Stellar G-address to bind. */
  @IsString()
  @Length(56, 56)
  @Matches(/^G[A-Z2-7]{55}$/, { message: 'Invalid Stellar address' })
  stellarAddress: string;

  /**
   * Signed challenge proving ownership of the Stellar key.
   * Encoded as base64 XDR of a signed TransactionEnvelope.
   */
  @IsString()
  signedChallenge: string;

  /** The original challenge transaction XDR that was signed. */
  @IsString()
  challengeXdr: string;
}

/**
 * Optional: query params used when initiating OIDC flow via GET.
 */
export class OidcInitiateQueryDto {
  /**
   * Where to redirect after successful auth. Only relative paths or origins
   * from the configured frontend allowlist are accepted (see
   * `isSafeRedirectTarget`).
   */
  @IsOptional()
  @IsString()
  redirectTo?: string;
}

/**
 * Body for POST /auth/oidc/exchange — trades the one-time code returned by
 * the OIDC callback redirect for the actual access token.
 */
export class OidcExchangeCodeDto {
  @IsString()
  code: string;
}

// ---------------------------------------------------------------------------
// Redirect validation
// ---------------------------------------------------------------------------

/**
 * Returns true when `redirectTo` is safe to redirect to after OIDC login.
 *
 * Allowed:
 *  - relative paths (e.g. `/dashboard`, `/settings?tab=security`)
 *  - absolute URLs whose origin is in `allowedOrigins`
 *
 * Rejected:
 *  - protocol-relative URLs (`//evil.example`, `/\evil.example`)
 *  - absolute URLs with a scheme (e.g. `javascript:`, `https://evil.example`)
 *    unless their origin is allowlisted
 *  - anything that does not parse as a URL
 */
export function isSafeRedirectTarget(
  redirectTo: string | undefined | null,
  allowedOrigins: string[] = [],
): boolean {
  if (!redirectTo || typeof redirectTo !== 'string') {
    return false;
  }

  // Reject protocol-relative and backslash tricks before any parsing.
  if (redirectTo.startsWith('//') || redirectTo.startsWith('/\\') || redirectTo.startsWith('\\')) {
    return false;
  }

  // Relative path: must start with a single `/` and not contain a scheme.
  if (redirectTo.startsWith('/')) {
    // Guard against `/%2F%2Fevil` style encoded protocol-relative paths.
    try {
      const decoded = decodeURIComponent(redirectTo);
      if (decoded.startsWith('//') || decoded.startsWith('/\\')) {
        return false;
      }
    } catch {
      return false;
    }
    return true;
  }

  // Absolute URL: only allow if origin is in the allowlist.
  let parsed: URL;
  try {
    parsed = new URL(redirectTo);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return false;
  }

  return allowedOrigins.some((origin) => {
    try {
      return new URL(origin).origin === parsed.origin;
    } catch {
      return false;
    }
  });
}

// ---------------------------------------------------------------------------
// Response shapes (plain interfaces, not validated)
// ---------------------------------------------------------------------------

export interface OidcAuthResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: {
    id: string;
    email: string | null;
    stellarAddress: string | null;
    oidcProvider: string;
    isNewUser: boolean;
  };
}

export interface OidcLinkResponse {
  linked: boolean;
  provider: string;
  email: string | null;
}
