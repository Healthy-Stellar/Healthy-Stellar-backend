import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthGuard } from '@nestjs/passport';

import { OidcService } from './oidc.service';
import { OidcClientRegistry, buildAuthorizationUrl, OidcVerifiedProfile } from './oidc.strategy';
import { OidcAuthGuard } from './guards/oidc-auth.guard';
import { LinkStellarAddressDto, OidcInitiateQueryDto } from './dto/oidc.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OidcJwtPayload } from './oidc.service';
import { ApiTags } from '@nestjs/swagger';

/**
 * Short-lived, signed, HttpOnly, SameSite=Lax cookie used to carry OIDC
 * state/nonce/redirect across the initiate → callback round-trip.
 *
 * No server-side session middleware is installed, so we persist the flow
 * data in a cookie instead of `req.session`. The cookie is signed with
 * OIDC_COOKIE_SECRET (falling back to JWT_SECRET) so it cannot be tampered
 * with, and it expires quickly to bound the CSRF window.
 */
const OIDC_FLOW_COOKIE_PREFIX = 'oidc_flow_';
const OIDC_FLOW_COOKIE_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

interface OidcFlowCookie {
  state: string;
  nonce: string;
  redirectTo?: string;
}

function flowCookieName(provider: string): string {
  return `${OIDC_FLOW_COOKIE_PREFIX}${provider}`;
}

function cookieSecret(): string {
  return process.env.OIDC_COOKIE_SECRET ?? process.env.JWT_SECRET ?? 'oidc-flow-dev-secret';
}

function base64UrlEncode(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64url');
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8');
}

function signPayload(payload: string): string {
  // Lazy require keeps this file free of a top-level crypto import churn.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const crypto = require('crypto') as typeof import('crypto');
  return crypto.createHmac('sha256', cookieSecret()).update(payload).digest('base64url');
}

function encodeFlowCookie(flow: OidcFlowCookie): string {
  const payload = base64UrlEncode(JSON.stringify(flow));
  return `${payload}.${signPayload(payload)}`;
}

function decodeFlowCookie(raw: string | undefined): OidcFlowCookie | null {
  if (!raw) return null;
  const [payload, signature] = raw.split('.');
  if (!payload || !signature) return null;
  const expected = signPayload(payload);
  if (
    expected.length !== signature.length ||
    !require('crypto').timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  ) {
    return null;
  }
  try {
    return JSON.parse(base64UrlDecode(payload)) as OidcFlowCookie;
  } catch {
    return null;
  }
}

function setFlowCookie(res: Response, provider: string, flow: OidcFlowCookie): void {
  res.cookie(flowCookieName(provider), encodeFlowCookie(flow), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: OIDC_FLOW_COOKIE_MAX_AGE_MS,
    path: '/',
  });
}

function clearFlowCookie(res: Response, provider: string): void {
  res.clearCookie(flowCookieName(provider), { path: '/' });
}

@ApiTags('auth/oidc')
@Controller('auth/oidc')
export class OidcController {
  constructor(
    private readonly oidcService: OidcService,
    private readonly registry: OidcClientRegistry,
  ) {}

  // ---------------------------------------------------------------------------
  // GET /auth/oidc/providers — list configured providers
  // ---------------------------------------------------------------------------
  @Get('providers')
  listProviders() {
    return {
      providers: this.registry.getAllProviderNames(),
    };
  }

  // ---------------------------------------------------------------------------
  // GET /auth/oidc/:provider — initiate OIDC flow
  // ---------------------------------------------------------------------------
  @Get(':provider')
  async initiate(
    @Param('provider') provider: string,
    @Query() query: OidcInitiateQueryDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    // Persist state/nonce/redirect in a signed, HttpOnly, SameSite=Lax cookie
    // instead of req.session (no session middleware is installed).
    const flow: OidcFlowCookie = { state: '', nonce: '', redirectTo: query.redirectTo };
    const authUrl = await buildAuthorizationUrl(this.registry, provider, flow);
    setFlowCookie(res, provider, flow);
    return res.redirect(authUrl);
  }

  // ---------------------------------------------------------------------------
  // POST /auth/oidc/:provider/callback — IdP callback (authorization code)
  // ---------------------------------------------------------------------------
  @Post(':provider/callback')
  @HttpCode(HttpStatus.OK)
  @UseGuards(OidcAuthGuard)
  async callback(
    @Param('provider') _provider: string,
    @Req() req: Request,
  ) {
    // req.user is populated by OidcStrategy.validate()
    const profile = req.user as OidcVerifiedProfile;
    return this.oidcService.handleOidcLogin(profile);
  }

  /**
   * GET variant — supports IdPs that redirect with GET (e.g. Azure AD default).
   * The strategy reads params from req.query via client.callbackParams(req).
   */
  @Get(':provider/callback')
  @UseGuards(OidcAuthGuard)
  async callbackGet(
    @Param('provider') provider: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const profile = req.user as OidcVerifiedProfile;
    const result = await this.oidcService.handleOidcLogin(profile);

    // Read the post-login redirect from the signed flow cookie, then clear it.
    const flow = decodeFlowCookie(req.cookies?.[flowCookieName(provider)]);
    const redirectTo = flow?.redirectTo ?? process.env.FRONTEND_URL ?? '/';
    clearFlowCookie(res, provider);

    // Attach token as a short-lived query param; frontend should exchange immediately
    const url = new URL(redirectTo);
    url.searchParams.set('oidc_token', result.accessToken);
    url.searchParams.set('is_new_user', String(result.user.isNewUser));
    return res.redirect(url.toString());
  }

  // ---------------------------------------------------------------------------
  // POST /auth/oidc/link — link OIDC identity to Stellar-authed user
  // Caller must be authenticated via existing Stellar JWT.
  // ---------------------------------------------------------------------------
  @Post('link/:provider/callback')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, OidcAuthGuard)
  async linkOidcIdentity(
    @Param('provider') _provider: string,
    @Req() req: Request,
    @CurrentUser() jwtUser: OidcJwtPayload,
  ) {
    const profile = req.user as OidcVerifiedProfile;
    return this.oidcService.linkOidcIdentityToUser(jwtUser.sub, profile);
  }

  // Initiate the link flow (redirect to IdP for the linking case)
  @Get('link/:provider')
  @UseGuards(JwtAuthGuard)
  async initiateLinking(
    @Param('provider') provider: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const flow: OidcFlowCookie = { state: '', nonce: '' };
    const authUrl = await buildAuthorizationUrl(this.registry, provider, flow);
    setFlowCookie(res, provider, flow);
    return res.redirect(authUrl);
  }

  // ---------------------------------------------------------------------------
  // POST /auth/oidc/link-stellar — bind a Stellar address to OIDC user
  // ---------------------------------------------------------------------------
  @Post('link-stellar')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async linkStellarAddress(
    @Body() dto: LinkStellarAddressDto,
    @CurrentUser() jwtUser: OidcJwtPayload,
  ) {
    return this.oidcService.linkStellarAddress(jwtUser.sub, dto);
  }

  // ---------------------------------------------------------------------------
  // GET /auth/oidc/identities — list linked OIDC identities for current user
  // ---------------------------------------------------------------------------
  @Get('identities')
  @UseGuards(JwtAuthGuard)
  async listIdentities(@CurrentUser() jwtUser: OidcJwtPayload) {
    return this.oidcService.getLinkedIdentities(jwtUser.sub);
  }

  // ---------------------------------------------------------------------------
  // DELETE /auth/oidc/identities/:id — unlink an OIDC identity
  // ---------------------------------------------------------------------------
  @Delete('identities/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  async unlinkIdentity(
    @Param('id') identityId: string,
    @CurrentUser() jwtUser: OidcJwtPayload,
  ) {
    await this.oidcService.unlinkOidcIdentity(jwtUser.sub, identityId);
  }
}
