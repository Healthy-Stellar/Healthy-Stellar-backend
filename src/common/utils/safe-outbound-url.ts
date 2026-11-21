import { BadRequestException } from '@nestjs/common';
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { promises as dns } from 'dns';
import * as http from 'http';
import * as https from 'https';
import { BlockList, isIP } from 'net';

const blockedRanges = new BlockList();
[
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
].forEach(([net, prefix]) => blockedRanges.addSubnet(net as string, prefix as number, 'ipv4'));
[
  ['::', 128],
  ['::1', 128],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
].forEach(([net, prefix]) => blockedRanges.addSubnet(net as string, prefix as number, 'ipv6'));

const BLOCKED_MESSAGE =
  'Webhook URL must be a public http(s) address and must not target a private, loopback, link-local, or metadata host';

export interface SafeOutboundTarget {
  url: URL;
  address: string;
  family: 4 | 6;
}

function isBlockedAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 0) return true;

  // IPv4-mapped IPv6 (::ffff:a.b.c.d or ::ffff:aabb:ccdd)
  const mapped = address.toLowerCase().match(/^::ffff:(.+)$/);
  if (family === 6 && mapped) {
    const rest = mapped[1];
    if (isIP(rest) === 4) return isBlockedAddress(rest);
    const hex = rest.split(':');
    if (hex.length === 2) {
      const n = (parseInt(hex[0], 16) << 16) | parseInt(hex[1], 16);
      return isBlockedAddress(`${(n >>> 24) & 255}.${(n >>> 16) & 255}.${(n >>> 8) & 255}.${n & 255}`);
    }
    return true;
  }

  return blockedRanges.check(address, family === 4 ? 'ipv4' : 'ipv6');
}

/**
 * Parses and validates an outbound URL, resolves its hostname and rejects it if
 * any resolved address is private/loopback/link-local/metadata. Returns the
 * validated address so the caller can pin the connection to it.
 */
export async function assertSafeOutboundUrl(rawUrl: string): Promise<SafeOutboundTarget> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new BadRequestException('Webhook URL is not a valid URL');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new BadRequestException('Webhook URL must use http or https');
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname === 'metadata.google.internal'
  ) {
    throw new BadRequestException(BLOCKED_MESSAGE);
  }

  let addresses: { address: string; family: number }[];
  if (isIP(hostname)) {
    addresses = [{ address: hostname, family: isIP(hostname) }];
  } else {
    try {
      addresses = await dns.lookup(hostname, { all: true });
    } catch {
      throw new BadRequestException('Webhook URL host could not be resolved');
    }
  }

  if (addresses.length === 0 || addresses.some((a) => isBlockedAddress(a.address))) {
    throw new BadRequestException(BLOCKED_MESSAGE);
  }

  return { url, address: addresses[0].address, family: addresses[0].family as 4 | 6 };
}

/**
 * POSTs to an outbound URL after SSRF validation. The connection is pinned to the
 * validated IP (defeats DNS rebinding) and redirects are never followed.
 */
export async function safePost<T = any>(
  rawUrl: string,
  data: unknown,
  config: AxiosRequestConfig = {},
): Promise<AxiosResponse<T>> {
  const target = await assertSafeOutboundUrl(rawUrl);
  const lookup = ((_host: string, options: any, cb: any) => {
    if (options?.all) cb(null, [{ address: target.address, family: target.family }]);
    else cb(null, target.address, target.family);
  }) as any;

  return axios.post<T>(rawUrl, data, {
    ...config,
    maxRedirects: 0,
    httpAgent: new http.Agent({ lookup }),
    httpsAgent: new https.Agent({ lookup }),
  });
}
