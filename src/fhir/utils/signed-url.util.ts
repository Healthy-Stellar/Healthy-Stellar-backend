import * as crypto from 'crypto';

const SIGNING_SECRET = process.env.EXPORT_SIGNING_SECRET ?? 'dev-signing-secret';
const SIGNED_URL_TTL_S = parseInt(process.env.EXPORT_URL_TTL_S ?? '3600', 10);

/**
 * Generate a time-limited, HMAC-SHA256-signed download URL for a bulk-export file.
 *
 * URL format:
 *   /fhir/r4/export-files/{jobId}/{resourceType}.ndjson
 *     ?_format={outputFormat}
 *     &expires={unixTimestamp}
 *     &sig={hmacHex}
 *
 * The signature covers `path:expiresAt` so that both path and expiry are
 * authenticated together.
 */
export function generateSignedUrl(
  jobId: string,
  resourceType: string,
  outputFormat: string,
): string {
  const expiresAt = Math.floor(Date.now() / 1000) + SIGNED_URL_TTL_S;
  const path = `/fhir/r4/export-files/${jobId}/${resourceType}.ndjson`;
  const payload = `${path}:${expiresAt}`;
  const sig = crypto.createHmac('sha256', SIGNING_SECRET).update(payload).digest('hex');
  return `${path}?_format=${encodeURIComponent(outputFormat)}&expires=${expiresAt}&sig=${sig}`;
}

/**
 * Verify a signed export URL.
 * Returns true when the signature is valid and the URL has not expired.
 */
export function verifySignedUrl(url: string): boolean {
  try {
    const parsed = new URL(url, 'http://localhost');
    const sig     = parsed.searchParams.get('sig');
    const expires = parsed.searchParams.get('expires');
    if (!sig || !expires) return false;

    const expiresAt = parseInt(expires, 10);
    if (Date.now() / 1000 > expiresAt) return false;

    const path    = parsed.pathname;
    const payload = `${path}:${expiresAt}`;
    const expected = crypto.createHmac('sha256', SIGNING_SECRET).update(payload).digest('hex');

    return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}
