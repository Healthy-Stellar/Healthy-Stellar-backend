import * as crypto from 'crypto';

/**
 * Validate and retrieve the signing secret for bulk-export URLs.
 * CRITICAL: This must be a cryptographically secure secret in production.
 * Falls back to dev-only default only in development mode.
 */
function getSigningSecret(): string {
  const secret = process.env.EXPORT_SIGNING_SECRET;
  const isDev = process.env.NODE_ENV !== 'production';

  if (!secret) {
    if (isDev) {
      console.warn(
        '⚠️  WARNING: EXPORT_SIGNING_SECRET not set. Using dev-only default. ' +
        'This is insecure and must not be used in production.',
      );
      return 'dev-signing-secret';
    }
    throw new Error(
      'CRITICAL: EXPORT_SIGNING_SECRET environment variable must be set in production. ' +
      'Without it, bulk-export download URLs will be unsigned or use a publicly known secret. ' +
      'This allows attackers to forge valid URLs to download full patient-data exports. ' +
      'Set a cryptographically secure secret (minimum 32 characters) before deploying.',
    );
  }

  // In production, enforce a minimum secret length to ensure cryptographic security
  if (isDev === false && secret.length < 32) {
    throw new Error(
      'CRITICAL: EXPORT_SIGNING_SECRET must be at least 32 characters in production. ' +
      `Current length: ${secret.length}. Use a cryptographically secure random string.`,
    );
  }

  return secret;
}

const SIGNING_SECRET = getSigningSecret();
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
 * Generate a time-limited, HMAC-SHA256-signed download URL for a GDPR DSAR
 * export bundle. Reuses the same signing scheme (path:expiresAt HMAC) as the
 * FHIR bulk-export signed URLs.
 */
export function generateGdprExportSignedUrl(requestId: string): string {
  const expiresAt = Math.floor(Date.now() / 1000) + SIGNED_URL_TTL_S;
  const path = `/gdpr/export-files/${requestId}/dsar-bundle.json`;
  const payload = `${path}:${expiresAt}`;
  const sig = crypto.createHmac('sha256', SIGNING_SECRET).update(payload).digest('hex');
  return `${path}?expires=${expiresAt}&sig=${sig}`;
}

/**
 * Verify a signed export URL.
 * Returns true when the signature is valid and the URL has not expired.
 */
export function verifySignedUrl(url: string): boolean {
  try {
    const parsed = new URL(url, 'http://localhost');
    const sig = parsed.searchParams.get('sig');
    const expires = parsed.searchParams.get('expires');
    if (!sig || !expires) return false;

    const expiresAt = parseInt(expires, 10);
    if (Date.now() / 1000 > expiresAt) return false;

    const path = parsed.pathname;
    const payload = `${path}:${expiresAt}`;
    const expected = crypto.createHmac('sha256', SIGNING_SECRET).update(payload).digest('hex');

    return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}
