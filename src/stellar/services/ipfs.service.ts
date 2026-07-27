import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { TracingService } from '../../common/services/tracing.service';
import { SpanKind } from '@opentelemetry/api';

export interface IpfsBlob {
  cid: string;
  encryptedPayload: string;
  metadata?: Record<string, any>;
}

export class ContentIntegrityError extends Error {
  constructor(
    public readonly cid: string,
    public readonly gateway: string,
    message: string,
  ) {
    super(message);
    this.name = 'ContentIntegrityError';
  }
}

// ── CID verification helpers ──────────────────────────────────────────────────

/** Base58btc alphabet used by CIDv0 / multihash */
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function base58Decode(input: string): Uint8Array {
  let num = BigInt(0);
  for (const char of input) {
    const idx = BASE58_ALPHABET.indexOf(char);
    if (idx < 0) throw new Error(`Invalid base58 character: ${char}`);
    num = num * BigInt(58) + BigInt(idx);
  }
  const hex = num.toString(16).padStart(2, '0');
  const bytes = Uint8Array.from(Buffer.from(hex.length % 2 ? '0' + hex : hex, 'hex'));
  // Prepend leading zero bytes for each leading '1' in the input
  const leading = input.match(/^1*/)?.[0].length ?? 0;
  const result = new Uint8Array(leading + bytes.length);
  result.set(bytes, leading);
  return result;
}

/**
 * Verify that `payload` matches `cid`.
 * - CIDv0: base58btc-encoded multihash — first two bytes are [0x12, 0x20] (sha2-256, 32 bytes)
 * - CIDv1: last 34 bytes of the decoded multibase payload are the sha2-256 multihash
 *
 * Returns true if the hash matches, false otherwise.
 */
function verifyCid(cid: string, payload: string): boolean {
  const digest = createHash('sha256').update(payload, 'utf8').digest();

  try {
    if (cid.startsWith('Qm')) {
      // CIDv0 — base58btc multihash: [0x12][0x20][32 bytes of sha256]
      const multihash = base58Decode(cid);
      if (multihash[0] !== 0x12 || multihash[1] !== 0x20) return false;
      const cidDigest = multihash.slice(2);
      return Buffer.from(cidDigest).equals(digest);
    } else {
      // CIDv1 — multibase-prefixed; last 34 bytes are the sha2-256 multihash
      // Strip the multibase prefix character and base-decode the rest
      const withoutPrefix = cid.slice(1);
      let decoded: Buffer;
      if (cid.startsWith('b') || cid.startsWith('B')) {
        // base32
        decoded = Buffer.from(
          withoutPrefix.toUpperCase().replace(/=/g, ''),
          'base64',
        );
        // Proper base32 decode — use Buffer trick via base32 alphabet mapping
        decoded = base32Decode(withoutPrefix);
      } else if (cid.startsWith('z')) {
        // base58btc
        decoded = Buffer.from(base58Decode(withoutPrefix));
      } else {
        return false; // unsupported multibase
      }
      // Last 34 bytes: [0x12][0x20][32-byte digest]
      const mh = decoded.slice(-34);
      if (mh[0] !== 0x12 || mh[1] !== 0x20) return false;
      return Buffer.from(mh.slice(2)).equals(digest);
    }
  } catch {
    return false;
  }
}

/** Minimal base32 (RFC 4648, no padding) decoder for CIDv1 base32 */
function base32Decode(input: string): Buffer {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz234567';
  const str = input.toLowerCase().replace(/=/g, '');
  let bits = 0;
  let value = 0;
  const output: number[] = [];
  for (const char of str) {
    const idx = alphabet.indexOf(char);
    if (idx < 0) throw new Error(`Invalid base32 character: ${char}`);
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}

// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class IpfsService {
  private readonly logger = new Logger(IpfsService.name);
  private readonly ipfsGateway: string;
  private readonly fallbackGateways: string[];

  constructor(
    private readonly configService: ConfigService,
    private readonly tracingService: TracingService,
  ) {
    this.ipfsGateway = this.configService.get<string>('IPFS_GATEWAY', 'https://ipfs.io/ipfs/');
    this.fallbackGateways = this.configService
      .get<string>('IPFS_FALLBACK_GATEWAYS', 'https://cloudflare-ipfs.com/ipfs/,https://gateway.pinata.cloud/ipfs/')
      .split(',')
      .map((g) => g.trim())
      .filter(Boolean);
  }

  async fetch(cid: string): Promise<IpfsBlob> {
    return this.tracingService.withSpan(
      'ipfs.fetch',
      async (span) => {
        span.setAttribute('ipfs.cid', cid);
        span.setAttribute('ipfs.gateway', this.ipfsGateway);

        this.logger.log(`Fetching IPFS content for CID: ${cid}`);
        this.tracingService.addEvent('ipfs.fetch.started', { cid });

        const gateways = [this.ipfsGateway, ...this.fallbackGateways];
        let lastError: Error | undefined;

        for (const gateway of gateways) {
          try {
            const startTime = Date.now();
            const response = await fetch(`${gateway}${cid}`);

            if (!response.ok) {
              throw new Error(`IPFS fetch failed: ${response.statusText}`);
            }

            const encryptedPayload = await response.text();
            const duration = Date.now() - startTime;

            // ── Integrity check ──────────────────────────────────────────────
            if (!verifyCid(cid, encryptedPayload)) {
              const integrityErr = new ContentIntegrityError(
                cid,
                gateway,
                `CID integrity check failed: content returned by ${gateway} does not match CID ${cid}`,
              );
              this.logger.warn(integrityErr.message);
              lastError = integrityErr;
              continue; // try next gateway
            }

            span.setAttribute('ipfs.payload_size', encryptedPayload.length);
            span.setAttribute('ipfs.fetch_duration_ms', duration);
            span.setAttribute('ipfs.gateway_used', gateway);

            this.tracingService.addEvent('ipfs.fetch.completed', {
              cid,
              size: encryptedPayload.length,
              duration_ms: duration,
              gateway,
            });

            return {
              cid,
              encryptedPayload,
              metadata: {
                fetchedAt: new Date().toISOString(),
                size: encryptedPayload.length,
                duration_ms: duration,
                gateway,
              },
            };
          } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            if (error instanceof ContentIntegrityError) continue;
            this.logger.warn(`Gateway ${gateway} failed: ${lastError.message}`);
          }
        }

        this.logger.error(`All IPFS gateways failed for CID ${cid}: ${lastError?.message}`);
        this.tracingService.addEvent('ipfs.fetch.error', {
          error: lastError?.message,
        });
        throw lastError;
      },
      { 'span.kind': SpanKind.CLIENT },
      SpanKind.CLIENT,
    );
  }

  /**
   * Upload content to IPFS (if using local IPFS node)
   */
  async upload(content: string, metadata?: Record<string, any>): Promise<string> {
    return this.tracingService.withSpan(
      'ipfs.upload',
      async (span) => {
        span.setAttribute('ipfs.content_size', content.length);
        if (metadata) {
          span.setAttribute('ipfs.metadata', JSON.stringify(metadata));
        }

        this.logger.log(`Uploading content to IPFS (size: ${content.length} bytes)`);
        this.tracingService.addEvent('ipfs.upload.started', {
          size: content.length,
        });

        try {
          const startTime = Date.now();
          const ipfsApiUrl = this.configService.get<string>('IPFS_API_URL', 'http://localhost:5001');

          const formData = new FormData();
          formData.append('file', new Blob([content]), 'record.json');

          const response = await fetch(`${ipfsApiUrl}/api/v0/add`, {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) {
            throw new Error(`IPFS upload failed: ${response.statusText}`);
          }

          const result = await response.json() as { Hash: string };
          const cid = result.Hash;
          const duration = Date.now() - startTime;

          span.setAttribute('ipfs.cid', cid);
          span.setAttribute('ipfs.upload_duration_ms', duration);

          this.tracingService.addEvent('ipfs.upload.completed', {
            cid,
            size: content.length,
            duration_ms: duration,
          });

          return cid;
        } catch (error) {
          this.logger.error(`Failed to upload to IPFS: ${error.message}`, error.stack);
          this.tracingService.addEvent('ipfs.upload.error', {
            error: error instanceof Error ? error.message : String(error),
          });
          throw error;
        }
      },
      { 'span.kind': SpanKind.CLIENT },
      SpanKind.CLIENT,
    );
  }
}
