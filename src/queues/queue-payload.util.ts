import { createHmac, timingSafeEqual } from 'crypto';

const SIGNED_FIELDS = ['operationType', 'correlationId', 'initiatedBy', 'params'] as const;

/**
 * Compute HMAC-SHA256 over the canonical payload fields.
 * Only the fields that drive business logic are signed so that
 * tracing metadata (traceContext, traceId) can be added without
 * invalidating the signature.
 */
export function signQueuePayload(payload: Record<string, any>, secret: string): string {
  const canonical = JSON.stringify(
    SIGNED_FIELDS.reduce<Record<string, any>>((acc, key) => {
      acc[key] = payload[key] ?? null;
      return acc;
    }, {}),
  );
  return createHmac('sha256', secret).update(canonical).digest('hex');
}

/**
 * Verify the HMAC signature attached to a queue job payload.
 * Throws if the signature is missing or does not match.
 */
export function verifyQueuePayload(payload: Record<string, any>, secret: string): void {
  const { _sig, ...rest } = payload;
  if (!_sig) {
    throw new Error('Queue payload is missing integrity signature (_sig)');
  }
  const expected = signQueuePayload(rest, secret);
  const expectedBuf = Buffer.from(expected, 'hex');
  const actualBuf = Buffer.from(_sig as string, 'hex');
  if (
    expectedBuf.length !== actualBuf.length ||
    !timingSafeEqual(expectedBuf, actualBuf)
  ) {
    throw new Error('Queue payload integrity check failed: signature mismatch');
  }
}
