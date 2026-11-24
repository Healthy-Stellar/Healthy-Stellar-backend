import { isIP } from 'node:net';

/**
 * Value accepted by Express' `trust proxy` application setting.
 *
 * @see https://expressjs.com/en/guide/behind-proxies.html
 */
export type TrustProxySetting = boolean | number | string[];

const NAMED_RANGES = new Set(['loopback', 'linklocal', 'uniquelocal']);

function assertValidEntry(entry: string): void {
  const [address, prefix, ...rest] = entry.split('/');

  if (rest.length > 0) {
    throw new Error(`Invalid TRUST_PROXY entry "${entry}": too many "/" separators`);
  }

  if (NAMED_RANGES.has(address.toLowerCase())) {
    if (prefix !== undefined) {
      throw new Error(
        `Invalid TRUST_PROXY entry "${entry}": named ranges cannot use a prefix length`,
      );
    }
    return;
  }

  const family = isIP(address);
  if (family === 0) {
    throw new Error(
      `Invalid TRUST_PROXY entry "${entry}": expected an IP, CIDR, or one of ${[...NAMED_RANGES].join(', ')}`,
    );
  }

  if (prefix === undefined) {
    return;
  }

  if (!/^\d+$/.test(prefix)) {
    throw new Error(`Invalid TRUST_PROXY entry "${entry}": prefix length must be a number`);
  }

  const maxPrefix = family === 4 ? 32 : 128;
  if (Number(prefix) > maxPrefix) {
    throw new Error(
      `Invalid TRUST_PROXY entry "${entry}": prefix length must be between 0 and ${maxPrefix}`,
    );
  }
}

/**
 * Parse the TRUST_PROXY environment variable into a setting Express can use.
 *
 * Deliberately defaults to `false`: `X-Forwarded-For` must only be honoured when
 * the deployment explicitly declares its proxy hops. Setting this to `true`
 * blindly allows any caller to spoof their source address.
 */
export function resolveTrustProxy(raw?: string | null): TrustProxySetting {
  const value = (raw ?? '').trim();

  if (!value || value.toLowerCase() === 'false') {
    return false;
  }

  if (value.toLowerCase() === 'true') {
    return true;
  }

  if (/^\d+$/.test(value)) {
    return Number(value);
  }

  const entries = value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (entries.length === 0) {
    return false;
  }

  entries.forEach(assertValidEntry);

  return entries;
}
