import { IsIn, IsOptional, IsString, Length, Matches } from 'class-validator';

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export class OidcCallbackDto {
  @IsString()
  code: string;

  @IsString()
  state: string;
}

export class LinkOidcIdentityDto {
  @IsString()
  provider: string;

  @IsString()
  code: string;

  @IsString()
  state: string;
}

export class LinkStellarAddressDto {
  @IsString()
  @Length(56, 56)
  @Matches(/^G[A-Z2-7]{55}$/, { message: 'Invalid Stellar address' })
  stellarAddress: string;

  @IsString()
  signedChallenge: string;

  @IsString()
  challengeXdr: string;
}

export class OidcInitiateQueryDto {
  @IsOptional()
  @IsString()
  redirectTo?: string;
}

// ---------------------------------------------------------------------------
// PKCE / OAuth2 authorization server DTOs (Issue #649)
// ---------------------------------------------------------------------------

/** Query params for GET /oauth2/authorize */
export class OAuth2AuthorizeQueryDto {
  @IsString()
  response_type: string;

  @IsString()
  client_id: string;

  @IsString()
  redirect_uri: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  scope?: string;

  /** PKCE: base64url-encoded SHA-256 hash of the code_verifier */
  @IsOptional()
  @IsString()
  code_challenge?: string;

  /** PKCE: must be "S256" when code_challenge is provided */
  @IsOptional()
  @IsIn(['S256'])
  code_challenge_method?: 'S256';

  /** SMART on FHIR: launch context token from EHR */
  @IsOptional()
  @IsString()
  launch?: string;
}

/** Body for POST /oauth2/token */
export class OAuth2TokenDto {
  @IsString()
  grant_type: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  redirect_uri?: string;

  @IsOptional()
  @IsString()
  client_id?: string;

  @IsOptional()
  @IsString()
  client_secret?: string;

  /** PKCE: plain text verifier — server hashes it and compares to stored challenge */
  @IsOptional()
  @IsString()
  code_verifier?: string;
}

// ---------------------------------------------------------------------------
// Response shapes
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
