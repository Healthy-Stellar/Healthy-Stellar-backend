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
  /** Where to redirect after successful auth (validated server-side). */
  @IsOptional()
  @IsString()
  redirectTo?: string;
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
