import {
  Controller,
  Get,
  Post,
  Body,
  HttpCode,
  UseGuards,
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { IsArray, IsString, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { DrugInteractionService, InteractionWarning } from '../services/drug-interaction.service';

// ─── CDS Hooks 2.0 request / response shapes ─────────────────────────────────
// Spec: https://cds-hooks.org/specification/current/

class CdsMedicationDto {
  @IsString()
  system: string; // e.g. "http://www.nlm.nih.gov/research/umls/rxnorm"

  @IsString()
  code: string; // RxNorm CUI or local drug UUID

  @IsString()
  @IsOptional()
  display?: string;
}

class CdsHooksRequestDto {
  @IsString()
  hookInstance: string;

  @IsString()
  hook: string; // "medication-prescribe" | "order-select"

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CdsMedicationDto)
  medications: CdsMedicationDto[];
}

interface CdsCard {
  summary: string;
  detail: string;
  indicator: 'info' | 'warning' | 'critical';
  source: { label: string; url?: string };
  suggestions?: { label: string; actions: { type: string; description: string }[] }[];
}

interface CdsHooksResponse {
  cards: CdsCard[];
}

function warningToCard(w: InteractionWarning): CdsCard {
  const indicator: CdsCard['indicator'] =
    w.severity === 'contraindicated' || w.severity === 'major'
      ? 'critical'
      : w.severity === 'moderate'
        ? 'warning'
        : 'info';

  return {
    summary: `${w.severity.toUpperCase()} interaction: ${w.drug1Name} ↔ ${w.drug2Name}${w.via ? ` (via ${w.via})` : ''}`,
    detail: [
      `**Mechanism:** ${w.mechanism}`,
      `**Clinical effects:** ${w.clinicalEffects}`,
      `**Management:** ${w.management}`,
      `**Evidence level:** ${w.evidenceLevel}`,
      `**Source:** ${w.source}`,
    ].join('\n\n'),
    indicator,
    source: {
      label: w.source === 'openfda' ? 'OpenFDA Drug Label' : 'Internal Interaction Database',
      url: w.source === 'openfda' ? 'https://open.fda.gov/apis/drug/label/' : undefined,
    },
    suggestions:
      w.severity === 'contraindicated'
        ? [
            {
              label: 'Remove contraindicated drug',
              actions: [
                {
                  type: 'delete',
                  description: `Remove ${w.drug2Name} from the medication order`,
                },
              ],
            },
          ]
        : undefined,
  };
}

// ─── CDS client authentication ───────────────────────────────────────────────
// CDS Hooks 2.0 requires EHR clients to present a signed JWT (Authorization:
// Bearer) whose `iss` is on a configured allowlist and whose signature verifies
// against that issuer's trusted JWKS. Unknown issuers are rejected.

interface CdsTrustedIssuer {
  /** Expected `iss` claim value. */
  iss: string;
  /** JWKS URL used to resolve signing keys for this issuer. */
  jwksUrl: string;
  /** Optional expected `aud` claim value. */
  aud?: string;
}

interface CdsJwtHeader {
  alg?: string;
  kid?: string;
  typ?: string;
}

interface CdsJwtPayload {
  iss?: string;
  aud?: string | string[];
  jti?: string;
  exp?: number;
  nbf?: number;
  [key: string]: unknown;
}

interface CdsClientContext {
  iss: string;
  jti?: string;
}

const CDS_CLIENT_KEY = 'cdsClient';

function base64UrlDecode(input: string): Buffer {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, 'base64');
}

function parseJsonSegment<T>(segment: string): T {
  try {
    return JSON.parse(base64UrlDecode(segment).toString('utf8')) as T;
  } catch {
    throw new UnauthorizedException('Malformed CDS client JWT');
  }
}

/**
 * Loads the trusted CDS issuer allowlist from configuration.
 * Expected env: CDS_TRUSTED_ISSUERS = JSON array of { iss, jwksUrl, aud? }.
 */
function loadTrustedIssuers(): CdsTrustedIssuer[] {
  const raw = process.env.CDS_TRUSTED_ISSUERS;
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(
      (entry): entry is CdsTrustedIssuer =>
        !!entry && typeof entry.iss === 'string' && typeof entry.jwksUrl === 'string',
    );
  } catch {
    return [];
  }
}

@Injectable()
export class CdsClientAuthGuard implements CanActivate {
  private readonly logger = new Logger(CdsClientAuthGuard.name);

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request?.headers?.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing CDS client JWT');
    }

    const token = authHeader.slice('Bearer '.length).trim();
    const segments = token.split('.');
    if (segments.length !== 3) {
      throw new UnauthorizedException('Malformed CDS client JWT');
    }

    const header = parseJsonSegment<CdsJwtHeader>(segments[0]);
    const payload = parseJsonSegment<CdsJwtPayload>(segments[1]);

    if (!payload.iss) {
      throw new UnauthorizedException('CDS client JWT missing iss claim');
    }

    const trusted = loadTrustedIssuers().find((entry) => entry.iss === payload.iss);
    if (!trusted) {
      throw new ForbiddenException('Unknown CDS client issuer');
    }

    if (trusted.aud) {
      const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
      if (!audiences.includes(trusted.aud)) {
        throw new UnauthorizedException('CDS client JWT audience mismatch');
      }
    }

    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp === 'number' && payload.exp < now) {
      throw new UnauthorizedException('CDS client JWT expired');
    }
    if (typeof payload.nbf === 'number' && payload.nbf > now) {
      throw new UnauthorizedException('CDS client JWT not yet valid');
    }

    const verified = await this.verifySignature(token, header, trusted.jwksUrl);
    if (!verified) {
      throw new UnauthorizedException('CDS client JWT signature verification failed');
    }

    const client: CdsClientContext = { iss: payload.iss, jti: payload.jti };
    request[CDS_CLIENT_KEY] = client;
    return true;
  }

  /**
   * Verifies the JWT signature against the issuer's JWKS. Only asymmetric
   * algorithms are accepted; the `none` algorithm is always rejected.
   */
  private async verifySignature(
    token: string,
    header: CdsJwtHeader,
    jwksUrl: string,
  ): Promise<boolean> {
    if (!header.alg || header.alg === 'none') {
      return false;
    }

    try {
      const response = await fetch(jwksUrl);
      if (!response.ok) {
        this.logger.warn(`Failed to fetch JWKS from ${jwksUrl}: ${response.status}`);
        return false;
      }
      const jwks = (await response.json()) as { keys?: Array<Record<string, unknown>> };
      const keys = jwks.keys ?? [];
      const candidate = header.kid
        ? keys.find((k) => k.kid === header.kid)
        : keys[0];
      if (!candidate) {
        return false;
      }

      const [headerSeg, payloadSeg, signatureSeg] = token.split('.');
      const signingInput = `${headerSeg}.${payloadSeg}`;
      const signature = base64UrlDecode(signatureSeg);

      const { createPublicKey, verify } = await import('crypto');
      const publicKey = createPublicKey({ key: candidate as any, format: 'jwk' });
      const algorithm = header.alg.startsWith('RS')
        ? 'RSA-SHA256'
        : header.alg.startsWith('ES')
          ? 'SHA256'
          : 'RSA-SHA256';

      return verify(algorithm, Buffer.from(signingInput), publicKey, signature);
    } catch (error) {
      this.logger.warn(`CDS client JWT verification error: ${(error as Error).message}`);
      return false;
    }
  }
}

// ─── Per-client rate limiting ────────────────────────────────────────────────
// Simple in-memory sliding-window limiter keyed by the authenticated client
// issuer (falls back to remote address). Prevents the interaction engine from
// being used as an unattributed free oracle.

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 60;

@Injectable()
export class CdsClientRateLimitGuard implements CanActivate {
  private readonly hits = new Map<string, number[]>();

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const client: CdsClientContext | undefined = request?.[CDS_CLIENT_KEY];
    const key = client?.iss ?? request?.ip ?? 'unknown';

    const now = Date.now();
    const windowStart = now - RATE_LIMIT_WINDOW_MS;
    const timestamps = (this.hits.get(key) ?? []).filter((t) => t > windowStart);

    if (timestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
      throw new ForbiddenException('CDS client rate limit exceeded');
    }

    timestamps.push(now);
    this.hits.set(key, timestamps);
    return true;
  }
}

@ApiTags('CDS Hooks')
@Controller('cds-hooks')
export class CdsHooksController {
  constructor(private readonly interactionService: DrugInteractionService) {}

  /**
   * CDS Hooks 2.0 discovery endpoint.
   * EHR systems call GET /cds-hooks to enumerate available services.
   * Public per spec — no client JWT required.
   */
  @Get()
  @ApiOperation({ summary: 'CDS Hooks discovery endpoint' })
  @ApiResponse({ status: 200, description: 'Available CDS services' })
  discover() {
    return {
      services: [
        {
          hook: 'medication-prescribe',
          id: 'drug-interaction-check',
          title: 'Drug Interaction Checker',
          description:
            'Checks direct, indirect (BFS depth-2), and OpenFDA-validated drug interactions for the current medication regimen.',
          prefetch: {
            medications: 'MedicationRequest?patient={{context.patientId}}&status=active',
          },
        },
      ],
    };
  }

  /**
   * CDS Hooks 2.0 service endpoint.
   * EHR systems POST here during medication-prescribe / order-select workflows.
   * Requires a signed CDS client JWT from a trusted issuer.
   */
  @Post('drug-interaction-check')
  @HttpCode(200)
  @UseGuards(CdsClientAuthGuard, CdsClientRateLimitGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'CDS Hooks drug interaction check (medication-prescribe)' })
  @ApiResponse({ status: 200, description: 'CDS cards with interaction warnings' })
  @ApiResponse({ status: 401, description: 'Missing or invalid CDS client JWT' })
  @ApiResponse({ status: 403, description: 'Unknown issuer or rate limit exceeded' })
  async check(@Body() body: CdsHooksRequestDto): Promise<CdsHooksResponse> {
    // Extract local drug IDs from the medication coding (code field used as drugId)
    const drugIds = body.medications.map((m) => m.code);

    const result = await this.interactionService.checkInteractions(drugIds);

    const cards = result.warnings.map(warningToCard);

    return { cards };
  }
}
