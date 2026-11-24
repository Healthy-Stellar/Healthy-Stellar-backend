import { createHash, timingSafeEqual } from 'node:crypto';
import { BlockList, isIP } from 'node:net';
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

const IPV4_MAPPED_PREFIX = '::ffff:';

type IpFamily = 'ipv4' | 'ipv6';

function normalizeIp(raw: string): string {
  const ip = raw.trim();

  if (
    ip.toLowerCase().startsWith(IPV4_MAPPED_PREFIX) &&
    isIP(ip.slice(IPV4_MAPPED_PREFIX.length)) === 4
  ) {
    return ip.slice(IPV4_MAPPED_PREFIX.length);
  }

  return ip;
}

/**
 * Build a matcher from an explicit allowlist. Returns null when no allowlist is
 * configured, which means no network-based bypass is available.
 */
function buildAllowlist(raw: string, logger: Logger): BlockList | null {
  const entries = raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (entries.length === 0) {
    return null;
  }

  const blockList = new BlockList();

  for (const entry of entries) {
    const [address, prefix, ...rest] = entry.split('/');
    const family = isIP(address);

    if (rest.length > 0 || family === 0) {
      logger.warn(`Ignoring invalid METRICS_ALLOWED_NETWORKS entry: "${entry}"`);
      continue;
    }

    const type: IpFamily = family === 4 ? 'ipv4' : 'ipv6';

    if (prefix === undefined) {
      blockList.addAddress(address, type);
      continue;
    }

    const maxPrefix = family === 4 ? 32 : 128;
    const prefixLength = Number(prefix);

    if (!/^\d+$/.test(prefix) || prefixLength > maxPrefix) {
      logger.warn(
        `Ignoring invalid METRICS_ALLOWED_NETWORKS entry: "${entry}" (prefix must be 0-${maxPrefix})`,
      );
      continue;
    }

    blockList.addSubnet(address, prefixLength, type);
  }

  return blockList;
}

function isAllowlisted(blockList: BlockList | null, ip: string | undefined): boolean {
  if (!blockList || !ip) {
    return false;
  }

  const normalized = normalizeIp(ip);
  const family = isIP(normalized);

  if (family === 4) {
    return blockList.check(normalized, 'ipv4');
  }

  if (family === 6) {
    return blockList.check(normalized, 'ipv6');
  }

  return false;
}

/**
 * Constant-time comparison. Hashing first keeps the digests the same length, so
 * `timingSafeEqual` cannot throw for tokens of different lengths.
 */
function tokensMatch(provided: string, expected: string): boolean {
  const providedDigest = createHash('sha256').update(provided, 'utf8').digest();
  const expectedDigest = createHash('sha256').update(expected, 'utf8').digest();

  return timingSafeEqual(providedDigest, expectedDigest);
}

@Injectable()
export class MetricsAuthGuard implements CanActivate {
  private readonly logger = new Logger(MetricsAuthGuard.name);
  private readonly metricsToken: string;
  private readonly allowedNetworks: BlockList | null;

  constructor(private readonly configService: ConfigService) {
    this.metricsToken = this.configService.get<string>('METRICS_TOKEN', '') ?? '';

    const configuredNetworks = this.configService.get<string>('METRICS_ALLOWED_NETWORKS', '') ?? '';
    this.allowedNetworks = buildAllowlist(configuredNetworks, this.logger);
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    // Only trust Express' client IP. It honours X-Forwarded-For exclusively
    // according to the application's `trust proxy` setting.
    const clientIp = request.ip;

    // Network access is opt-in: with no allowlist configured, the token is
    // required even for loopback and container/private-network callers.
    if (isAllowlisted(this.allowedNetworks, clientIp)) {
      return true;
    }

    if (!this.metricsToken) {
      throw new ForbiddenException('Metrics access is not configured');
    }

    const token = request.headers['x-metrics-token'];

    if (typeof token !== 'string' || token.length === 0) {
      throw new UnauthorizedException('METRICS_TOKEN header is required');
    }

    if (!tokensMatch(token, this.metricsToken)) {
      throw new UnauthorizedException('Invalid METRICS_TOKEN');
    }

    return true;
  }
}
