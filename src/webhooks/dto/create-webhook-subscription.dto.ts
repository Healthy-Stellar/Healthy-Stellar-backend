import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, IsUrl, Matches, MaxLength } from 'class-validator';

/**
 * Rejects URLs that point at non-public hosts to prevent SSRF.
 * Blocks loopback, link-local (incl. cloud metadata 169.254.169.254),
 * RFC1918 private ranges, and other reserved/non-routable targets.
 */
const PRIVATE_HOST_PATTERNS: RegExp[] = [
  /^localhost$/i,
  /^127\./,
  /^0\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^::1$/i,
  /^fc00:/i,
  /^fe80:/i,
];

export function isPublicWebhookUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return false;
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, '');
  if (!hostname) {
    return false;
  }

  return !PRIVATE_HOST_PATTERNS.some((pattern) => pattern.test(hostname));
}

export class CreateWebhookSubscriptionDto {
  @ApiProperty({ description: 'Target URL for webhook deliveries' })
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  @Matches(/^https?:\/\//i, { message: 'url must use http or https' })
  url: string;

  @ApiProperty({ description: 'Shared secret used to sign deliveries' })
  @IsString()
  @MaxLength(256)
  secret: string;

  @ApiProperty({ required: false, description: 'Whether the subscription is active' })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
