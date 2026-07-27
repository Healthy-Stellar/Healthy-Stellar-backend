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

import { PkceService } from './pkce.service';
import { OAuth2AuthorizeQueryDto, OAuth2TokenDto } from './dto/oidc.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/services/auth-token.service';
import { Patient } from '../users/entities/patient.entity';

/**
 * OAuth2 authorization server endpoints (Issue #649 — PKCE for public clients).
 *
 * GET  /oauth2/authorize  — requires the caller to already hold a session JWT
 *                           (e.g. SPA has logged in via password / OIDC).
 * POST /oauth2/token      — exchange authorization code for an access token;
 *                           PKCE verifier is enforced when a challenge was stored.
 */
@Controller('oauth2')
export class OAuth2Controller {
  constructor(
    private readonly pkce: PkceService,
    private readonly jwt: JwtService,
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
}
