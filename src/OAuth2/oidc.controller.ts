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
    const session = req.session as Record<string, unknown>;

    // Persist optional post-login redirect destination
    if (query.redirectTo) {
      session[`oidc_redirect_${provider}`] = query.redirectTo;
    }

    const authUrl = await buildAuthorizationUrl(this.registry, provider, session);
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
    @Param('provider') _provider: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const profile = req.user as OidcVerifiedProfile;
    const result = await this.oidcService.handleOidcLogin(profile);

    // Redirect to frontend with token in query (or use a code-exchange pattern)
    const session = req.session as Record<string, unknown>;
    const redirectTo =
      (session[`oidc_redirect_${profile.provider}`] as string | undefined) ??
      process.env.FRONTEND_URL ??
      '/';

    delete session[`oidc_redirect_${profile.provider}`];

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
    const session = req.session as Record<string, unknown>;
    const authUrl = await buildAuthorizationUrl(this.registry, provider, session);
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
