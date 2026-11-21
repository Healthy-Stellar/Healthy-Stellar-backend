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
  async token(@Body() dto: OAuth2TokenDto) {
    if (dto.grant_type === 'authorization_code') {
      return this.handleAuthorizationCodeGrant(dto);
    } else if (dto.grant_type === 'refresh_token') {
      return this.handleRefreshTokenGrant(dto);
    } else {
      throw new BadRequestException('unsupported_grant_type');
    }
  }

  private async handleAuthorizationCodeGrant(dto: OAuth2TokenDto) {
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
    return this.generateTokenResponse(entry.userId, smartScopes, entry.clientId);
  }

  private async handleRefreshTokenGrant(dto: OAuth2TokenDto) {
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
      // Decode the JWT to get the user ID, scopes, and original sessionId
      decodedToken = this.jwt.verify(dto.refresh_token, { ignoreExpiration: true });
    } catch (err) {
      throw new UnauthorizedException('invalid_grant: invalid refresh token');
    }

    const sessionId = decodedToken.sessionId;
    if (!sessionId) {
      throw new UnauthorizedException('invalid_grant: malformed refresh token');
    }

    // This validates rotation and detects reuse via the Redis store
    await this.refreshTokenStore.consumeAndValidate(sessionId, dto.refresh_token);

    const smartScopes = this.filterSmartScopes(decodedToken.scope);
    return this.generateTokenResponse(decodedToken.sub, smartScopes, dto.client_id, sessionId);
  }

  private async generateTokenResponse(userId: string, scopes: string[], clientId: string, existingSessionId?: string) {
    const sessionId = existingSessionId ?? crypto.randomUUID();
    
    const tokenPayload: Record<string, any> = {
      sub: userId,
      scope: scopes.join(' '),
      client_id: clientId,
      sessionId,
    };

    if (scopes.includes('fhirUser')) {
      tokenPayload.fhirUser = `${process.env.FHIR_BASE_URL ?? \`http://localhost:\${process.env.PORT ?? 3000}\`}/fhir/r4/Patient/${userId}`;
    }

    const accessToken = this.jwt.sign(tokenPayload);

    const response: Record<string, any> = {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 900,
      scope: scopes.join(' '),
    };

    // If offline_access was granted, issue a new refresh token
    if (scopes.includes('offline_access')) {
      const refreshToken = this.jwt.sign({ ...tokenPayload, type: 'refresh' }, { expiresIn: '7d' });
      await this.refreshTokenStore.store(sessionId, refreshToken);
      response.refresh_token = refreshToken;
    }

    if (scopes.includes('launch/patient')) {
      const patient = await this.patientRepo.findOne({
        where: { userId },
      });
      if (patient) {
        response.patient = patient.id;
      } else {
        throw new UnauthorizedException('launch_patient_required: user has no associated patient record');
      }
    }

    return response;
  }

  private filterSmartScopes(scopeString: string): string[] {
    return scopeString
      .split(/\s+/)
      .filter((s) => s.startsWith('patient/') || s.startsWith('user/') || s === 'launch/patient' || s === 'openid' || s === 'fhirUser' || s === 'offline_access');
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
