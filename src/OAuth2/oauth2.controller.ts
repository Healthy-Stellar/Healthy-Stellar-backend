import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request, Response } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';

import { PkceService } from './pkce.service';
import { OAuth2ClientRegistryService } from './oauth2-client-registry.service';
import { OAuth2AuthorizeQueryDto, OAuth2TokenDto } from './dto/oidc.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/services/auth-token.service';
import { Patient } from '../users/entities/patient.entity';
import { ApiTags } from '@nestjs/swagger';
import { RefreshTokenStoreService } from '../auth/services/refresh-token-store.service';
import { SessionManagementService } from '../auth/services/session-management.service';

const OAUTH2_ACCESS_TOKEN_TTL_SECONDS = 900;
const OAUTH2_REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

interface TokenRequestContext {
  ipAddress: string;
  userAgent: string;
}

@ApiTags('oauth2')
@Controller('oauth2')
export class OAuth2Controller {
  constructor(
    private readonly pkce: PkceService,
    private readonly jwt: JwtService,
    private readonly clientRegistry: OAuth2ClientRegistryService,
    private readonly refreshTokenStore: RefreshTokenStoreService,
    @InjectRepository(Patient)
    private readonly patientRepo: Repository<Patient>,
    private readonly sessionManagement: SessionManagementService,
  ) {}

  @Get('authorize')
  @UseGuards(JwtAuthGuard)
  authorize(
    @Query() query: OAuth2AuthorizeQueryDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (query.response_type !== 'code') {
      throw new BadRequestException('unsupported_response_type');
    }

    const client = this.clientRegistry.getClient(query.client_id);
    if (!client) {
      throw new BadRequestException('invalid_client: unknown client_id');
    }

    if (!this.clientRegistry.isRedirectUriRegistered(client, query.redirect_uri)) {
      throw new BadRequestException(
        'invalid_request: redirect_uri is not registered for this client',
      );
    }

    if (client.requirePkce && !query.code_challenge) {
      throw new BadRequestException('invalid_request: code_challenge is required for this client');
    }

    const user = (req as any).user as JwtPayload;

    const code = this.pkce.issueCode(
      query.client_id,
      query.redirect_uri,
      user.userId,
      query.scope ?? 'openid',
      query.code_challenge,
      query.code_challenge_method,
      query.launch,
    );

    const redirect = new URL(query.redirect_uri);
    redirect.searchParams.set('code', code);
    if (query.state) redirect.searchParams.set('state', query.state);

    return res.redirect(redirect.toString());
  }

  @Post('token')
  @HttpCode(HttpStatus.OK)
  async token(@Body() dto: OAuth2TokenDto, @Req() req: Request) {
    const ctx: TokenRequestContext = {
      ipAddress: (req?.ip || req?.socket?.remoteAddress || 'unknown').toString(),
      userAgent: req?.get?.('user-agent') ?? 'unknown',
    };

    if (dto.grant_type === 'authorization_code') {
      return this.handleAuthorizationCodeGrant(dto, ctx);
    } else if (dto.grant_type === 'refresh_token') {
      return this.handleRefreshTokenGrant(dto, ctx);
    } else {
      throw new BadRequestException('unsupported_grant_type');
    }
  }

  private async handleAuthorizationCodeGrant(dto: OAuth2TokenDto, ctx: TokenRequestContext) {
    if (!dto.code || !dto.client_id || !dto.redirect_uri) {
      throw new BadRequestException(
        'invalid_request: code, client_id and redirect_uri are required',
      );
    }

    const client = this.clientRegistry.getClient(dto.client_id);
    if (!client) {
      throw new BadRequestException('invalid_client: unknown client_id');
    }

    if (client.clientSecret) {
      if (!dto.client_secret || !this.isClientSecretValid(dto.client_secret, client.clientSecret)) {
        throw new UnauthorizedException('invalid_client: client authentication failed');
      }
    }

    const entry = this.pkce.consumeCode(
      dto.code,
      dto.client_id,
      dto.redirect_uri,
      dto.code_verifier,
    );

    const smartScopes = this.filterSmartScopes(entry.scope);
    return this.generateTokenResponse(entry.userId, smartScopes, entry.clientId, ctx);
  }

  private async handleRefreshTokenGrant(dto: OAuth2TokenDto, ctx: TokenRequestContext) {
    if (!dto.refresh_token || !dto.client_id) {
      throw new BadRequestException('invalid_request: refresh_token and client_id are required');
    }

    const client = this.clientRegistry.getClient(dto.client_id);
    if (!client) {
      throw new BadRequestException('invalid_client: unknown client_id');
    }

    if (client.clientSecret) {
      if (!dto.client_secret || !this.isClientSecretValid(dto.client_secret, client.clientSecret)) {
        throw new UnauthorizedException('invalid_client: client authentication failed');
      }
    }

    let decodedToken: any;
    try {
      // Decode the JWT to get the user ID, scopes, and original sessionId.
      // Expiration is enforced here so an expired refresh token is rejected
      // regardless of the TTL applied by the Redis store.
      decodedToken = this.jwt.verify(dto.refresh_token);
    } catch (err) {
      throw new UnauthorizedException('invalid_grant: invalid refresh token');
    }

    if (decodedToken.type !== 'refresh') {
      throw new UnauthorizedException('invalid_grant: token is not a refresh token');
    }

    if (decodedToken.client_id !== dto.client_id) {
      throw new UnauthorizedException(
        'invalid_grant: refresh token was not issued to this client',
      );
    }

    const sessionId = decodedToken.sessionId;
    if (!sessionId) {
      throw new UnauthorizedException('invalid_grant: malformed refresh token');
    }

    // This validates rotation and detects reuse via the Redis store
    await this.refreshTokenStore.consumeAndValidate(sessionId, dto.refresh_token);

    // Constrain the new grant to the original grant intersected with the
    // scopes the client is registered for.
    const grantedScopes = this.filterSmartScopes(decodedToken.scope);
    const allowedScopes = client.allowedScopes ?? [];
    const smartScopes = grantedScopes.filter((scope) => allowedScopes.includes(scope));

    if (smartScopes.length === 0) {
      throw new BadRequestException('invalid_scope: no granted scope is allowed for this client');
    }

    return this.generateTokenResponse(decodedToken.sub, smartScopes, dto.client_id, ctx, sessionId);
  }

  /**
   * Issues the OAuth2 token response. The `sessionId` embedded in the tokens
   * is always the primary key of a persisted `sessions` row: a new row for
   * the authorization-code grant, or the existing row (rotated, and rejected
   * if revoked/expired) for the refresh grant.
   */
  private async generateTokenResponse(
    userId: string,
    scopes: string[],
    clientId: string,
    ctx: TokenRequestContext,
    existingSessionId?: string,
  ) {
    // Resolve the patient context before minting anything so a failed launch
    // does not leave an orphaned session or refresh token behind.
    let patientId: string | undefined;
    if (scopes.includes('launch/patient')) {
      const patient = await this.patientRepo.findOne({
        where: { userId },
      });
      if (!patient) {
        throw new UnauthorizedException('launch_patient_required: user has no associated patient record');
      }
      patientId = patient.id;
    }

    const sessionId = existingSessionId ?? this.sessionManagement.generateSessionId();

    const tokenPayload: Record<string, any> = {
      sub: userId,
      scope: scopes.join(' '),
      client_id: clientId,
      sessionId,
    };

    if (scopes.includes('fhirUser')) {
      const fhirBase =
        process.env.FHIR_BASE_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;
      tokenPayload.fhirUser = `${fhirBase}/fhir/r4/Patient/${userId}`;
    }

    const accessToken = this.jwt.sign(tokenPayload);

    // If offline_access was granted, issue a new refresh token
    const refreshToken = scopes.includes('offline_access')
      ? this.jwt.sign({ ...tokenPayload, type: 'refresh' }, { expiresIn: '7d' })
      : null;

    const now = Date.now();
    const expiresAt = new Date(now + OAUTH2_ACCESS_TOKEN_TTL_SECONDS * 1000);
    const refreshTokenExpiresAt = refreshToken
      ? new Date(now + OAUTH2_REFRESH_TOKEN_TTL_SECONDS * 1000)
      : expiresAt;

    if (existingSessionId) {
      // Throws if the session was revoked, expired or never existed.
      await this.sessionManagement.rotateSession(existingSessionId, refreshToken, refreshTokenExpiresAt);
    } else {
      await this.sessionManagement.createSession({
        sessionId,
        userId,
        clientId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        refreshToken,
        refreshTokenExpiresAt,
      });
    }

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: OAUTH2_ACCESS_TOKEN_TTL_SECONDS,
      refresh_token: refreshToken ?? undefined,
      scope: scopes.join(' '),
      patient: patientId,
    };
  }

  private filterSmartScopes(scope: string | string[] | undefined): string[] {
    const raw = Array.isArray(scope) ? scope.join(' ') : scope ?? '';
    return raw
      .split(/\s+/)
      .filter((s) => s.length > 0)
      .filter((s) => SMART_SCOPES.has(s));
  }

  private isClientSecretValid(provided: string, expected: string): boolean {
    const providedBuf = Buffer.from(provided);
    const expectedBuf = Buffer.from(expected);
    if (providedBuf.length !== expectedBuf.length) {
      return false;
    }
    return crypto.timingSafeEqual(providedBuf, expectedBuf);
  }
}

const SMART_SCOPES = new Set([
  'openid',
  'profile',
  'email',
  'fhirUser',
  'launch',
  'launch/patient',
  'offline_access',
  'patient/*.read',
  'patient/*.write',
  'user/*.read',
  'user/*.write',
]);
