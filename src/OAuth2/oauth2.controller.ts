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

/**
 * OAuth2 authorization server endpoints (Issue #649 — PKCE for public clients).
 *
 * GET  /oauth2/authorize  — requires the caller to already hold a session JWT
 *                           (e.g. SPA has logged in via password / OIDC).
 * POST /oauth2/token      — exchange authorization code for an access token;
 *                           PKCE verifier is enforced when a challenge was stored.
 */
@ApiTags('oauth2')
@Controller('oauth2')
export class OAuth2Controller {
  constructor(
    private readonly pkce: PkceService,
    private readonly jwt: JwtService,
    private readonly clientRegistry: OAuth2ClientRegistryService,
    @InjectRepository(Patient)
    private readonly patientRepo: Repository<Patient>,
  ) {}

  // -------------------------------------------------------------------------
  // GET /oauth2/authorize
  // -------------------------------------------------------------------------
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

  // -------------------------------------------------------------------------
  // POST /oauth2/token
  // -------------------------------------------------------------------------
  @Post('token')
  @HttpCode(HttpStatus.OK)
  async token(@Body() dto: OAuth2TokenDto) {
    if (dto.grant_type !== 'authorization_code') {
      throw new BadRequestException('unsupported_grant_type');
    }

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

    // consumeCode validates PKCE when a challenge was stored for this code
    const entry = this.pkce.consumeCode(
      dto.code,
      dto.client_id,
      dto.redirect_uri,
      dto.code_verifier,
    );

    const smartScopes = entry.scope
      .split(/\s+/)
      .filter((s) => s.startsWith('patient/') || s.startsWith('user/') || s === 'launch/patient' || s === 'openid' || s === 'fhirUser');

    const tokenPayload: Record<string, any> = {
      sub: entry.userId,
      scope: smartScopes.join(' '),
      client_id: entry.clientId,
    };

    if (smartScopes.includes('fhirUser')) {
      tokenPayload.fhirUser = `${process.env.FHIR_BASE_URL ?? `http://localhost:${process.env.PORT ?? 3000}`}/fhir/r4/Patient/${entry.userId}`;
    }

    const accessToken = this.jwt.sign(tokenPayload);

    const response: Record<string, any> = {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 900,
      scope: smartScopes.join(' '),
    };

    // SMART on FHIR: launch/patient context
    if (smartScopes.includes('launch/patient')) {
      const patient = await this.patientRepo.findOne({
        where: { userId: entry.userId },
      });
      if (patient) {
        response.patient = patient.id;
      } else {
        throw new UnauthorizedException('launch_patient_required: user has no associated patient record');
      }
    }

    return response;
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
