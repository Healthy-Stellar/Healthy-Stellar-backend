import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  Res,
  Req,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { randomBytes } from 'crypto';
import { OidcService } from './oidc.service';
import { OidcLoginDto, OidcExchangeDto } from './oidc.dto';

const ONE_TIME_CODE_TTL_MS = 60 * 1000;

interface PendingCode {
  accessToken: string;
  expiresAt: number;
}

@Controller('auth/oidc')
export class OidcController {
  private readonly pendingCodes = new Map<string, PendingCode>();

  constructor(private readonly oidcService: OidcService) {}

  private getAllowedOrigins(): string[] {
    const raw = process.env.OIDC_ALLOWED_REDIRECT_ORIGINS || '';
    return raw
      .split(',')
      .map((o) => o.trim())
      .filter((o) => o.length > 0);
  }

  private resolveRedirectTo(redirectTo?: string): string {
    if (!redirectTo) {
      return '/';
    }
    // Reject protocol-relative URLs like //evil.example
    if (redirectTo.startsWith('//') || redirectTo.startsWith('/\\')) {
      throw new BadRequestException('Invalid redirectTo');
    }
    // Relative path
    if (redirectTo.startsWith('/')) {
      return redirectTo;
    }
    // Absolute URL must match an allowlisted origin
    let parsed: URL;
    try {
      parsed = new URL(redirectTo);
    } catch {
      throw new BadRequestException('Invalid redirectTo');
    }
    const allowed = this.getAllowedOrigins();
    if (!allowed.includes(parsed.origin)) {
      throw new BadRequestException('redirectTo origin is not allowed');
    }
    return parsed.toString();
  }

  private issueOneTimeCode(accessToken: string): string {
    const now = Date.now();
    for (const [code, entry] of this.pendingCodes) {
      if (entry.expiresAt <= now) {
        this.pendingCodes.delete(code);
      }
    }
    const code = randomBytes(32).toString('hex');
    this.pendingCodes.set(code, {
      accessToken,
      expiresAt: now + ONE_TIME_CODE_TTL_MS,
    });
    return code;
  }

  @Get(':provider')
  async loginGet(
    @Param('provider') provider: string,
    @Query() query: OidcLoginDto,
    @Res() res: Response,
  ) {
    const redirectTo = this.resolveRedirectTo(query.redirectTo);
    const authUrl = await this.oidcService.getAuthorizationUrl(provider, redirectTo);
    return res.redirect(authUrl);
  }

  @Get(':provider/callback')
  async callbackGet(
    @Param('provider') provider: string,
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    const result = await this.oidcService.handleCallback(provider, code, state);
    const redirectTo = this.resolveRedirectTo(result.redirectTo);
    const oneTimeCode = this.issueOneTimeCode(result.accessToken);

    const url = new URL(redirectTo, 'http://localhost');
    url.searchParams.set('oidc_code', oneTimeCode);
    const target = redirectTo.startsWith('/')
      ? `${url.pathname}${url.search}`
      : url.toString();
    return res.redirect(target);
  }

  @Post('exchange')
  async exchangeCode(@Body() body: OidcExchangeDto) {
    const entry = this.pendingCodes.get(body.code);
    if (!entry) {
      throw new UnauthorizedException('Invalid or expired code');
    }
    this.pendingCodes.delete(body.code);
    if (entry.expiresAt <= Date.now()) {
      throw new UnauthorizedException('Invalid or expired code');
    }
    return { accessToken: entry.accessToken };
  }
}
