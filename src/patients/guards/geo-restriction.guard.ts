import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import * as geoip from 'geoip-lite';
import { PatientsService } from '../patients.service';

/** Datacenter/hosting org name fragments used as a simple VPN/proxy heuristic. */
const PROXY_ORG_HINTS = [
  'amazonaws', 'digitalocean', 'linode', 'vultr', 'ovh',
  'hetzner', 'choopa', 'psychz', 'quadranet', 'serverius',
];

function resolveIp(req: any): string {
  const forwarded = req.headers?.['x-forwarded-for'];
  if (forwarded) {
    return (Array.isArray(forwarded) ? forwarded[0] : forwarded)
      .split(',')[0]
      .trim();
  }
  return req.ip ?? req.connection?.remoteAddress ?? '';
}

function isLikelyProxy(geo: geoip.Lookup | null): boolean {
  if (!geo) return false;
  const org: string = ((geo as any).org ?? (geo as any).isp ?? '').toLowerCase();
  return PROXY_ORG_HINTS.some((hint) => org.includes(hint));
}

@Injectable()
export class GeoRestrictionGuard implements CanActivate {
  private readonly logger = new Logger(GeoRestrictionGuard.name);

  constructor(private readonly patientsService: PatientsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();

    // Admin bypass — skip all geo checks
    if (req.user?.role === 'admin') return true;

    // Resolve patient identifier from route params
    const patientId: string = req.params?.address ?? req.params?.id;
    if (!patientId) return true;

    const patient = await this.patientsService.findById(patientId);
    const allowed = patient.allowedCountries;

    // No restrictions configured — allow all
    if (!allowed || allowed.length === 0) return true;

    const ip = resolveIp(req);
    const geo = geoip.lookup(ip);
    const country = geo?.country ?? null;

    // VPN/proxy detection — warn but do NOT block
    if (isLikelyProxy(geo)) {
      this.logger.warn(
        `Possible VPN/proxy detected for IP ${ip} accessing patient ${patientId}`,
      );
    }

    const normalizedAllowed = allowed.map((c) => c.toUpperCase());
    if (!country || !normalizedAllowed.includes(country.toUpperCase())) {
      throw new ForbiddenException(
        `Access denied: your region (${country ?? 'unknown'}) is not permitted to access this record.`,
      );
    }

    return true;
  }
}
