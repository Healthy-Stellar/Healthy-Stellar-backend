import { PhiKeyManagedTransformer } from '../phi-key-managed.transformer';
import { randomBytes } from 'crypto';

/**
 * Unit tests for PhiKeyManagedTransformer.
 *
 * Verifies that fields are encrypted to opaque base64 ciphertext (not plaintext)
 * and that round-trip decrypt(encrypt(x)) === x.
 */

const TEST_DEK = randomBytes(32);
const HMAC_PLAINTEXT_MARKERS = ['123-45-6789', 'John Doe', 'lisinopril', 'prescription'];

const BASE64_RE = /^[A-Za-z0-9+/]+=*$/;

describe('PhiKeyManagedTransformer', () => {
  describe('deterministic mode (searchable fields, e.g. SSN)', () => {
    const transformer = new PhiKeyManagedTransformer(TEST_DEK, true);

    it('encrypts to opaque base64 -- no plaintext PHI in raw column value', () => {
      const raw = transformer.to('123-45-6789');
      expect(raw).not.toBeNull();
      expect(BASE64_RE.test(raw!)).toBe(true);
      expect(raw).not.toContain('123-45-6789');
    });

    it('produces identical ciphertext for identical input (searchable index)', () => {
      const a = transformer.to('123-45-6789');
      const b = transformer.to('123-45-6789');
      expect(a).toEqual(b);
    });

    it('produces different ciphertext for different inputs', () => {
      const a = transformer.to('111-11-1111');
      const b = transformer.to('222-22-2222');
      expect(a).not.toEqual(b);
    });

    it('round-trips correctly: decrypt(encrypt(x)) === x', () => {
      const value = '987-65-4321';
      const encrypted = transformer.to(value);
      const decrypted = transformer.from(encrypted);
      expect(decrypted).toBe(value);
    });

    it('returns null for null/undefined input', () => {
      expect(transformer.to(null)).toBeNull();
      expect(transformer.to(undefined)).toBeNull();
      expect(transformer.from(null)).toBeNull();
      expect(transformer.from(undefined)).toBeNull();
    });

    it('returns null on tampered ciphertext (auth tag failure)', () => {
      const encrypted = transformer.to('123-45-6789')!;
      const buf = Buffer.from(encrypted, 'base64');
      buf[buf.length - 1] ^= 0xff;
      expect(transformer.from(buf.toString('base64'))).toBeNull();
    });
  });

  describe('randomised mode (free-text PHI, e.g. notes, prescriptionDetails)', () => {
    const transformer = new PhiKeyManagedTransformer(TEST_DEK, false);

    it('encrypts to opaque base64 -- no plaintext PHI in raw column value', () => {
      const raw = transformer.to('Patient prescribed lisinopril 10mg');
      expect(raw).not.toBeNull();
      expect(BASE64_RE.test(raw!)).toBe(true);
      expect(raw).not.toContain('lisinopril');
    });

    it('produces different ciphertext on each write (randomised IV)', () => {
      const a = transformer.to('same value');
      const b = transformer.to('same value');
      expect(a).not.toEqual(b);
    });

    it('round-trips correctly: decrypt(encrypt(x)) === x', () => {
      const value = 'Annual checkup - blood pressure elevated. Follow-up in 2 weeks.';
      const encrypted = transformer.to(value);
      const decrypted = transformer.from(encrypted);
      expect(decrypted).toBe(value);
    });

    it('returns null for null/undefined input', () => {
      expect(transformer.to(null)).toBeNull();
      expect(transformer.to(undefined)).toBeNull();
      expect(transformer.from(null)).toBeNull();
      expect(transformer.from(undefined)).toBeNull();
    });

    it('returns null on tampered ciphertext', () => {
      const encrypted = transformer.to('sensitive data')!;
      const buf = Buffer.from(encrypted, 'base64');
      buf[buf.length - 1] ^= 0xff;
      expect(transformer.from(buf.toString('base64'))).toBeNull();
    });
  });

  describe('cross-mode isolation', () => {
    const detTransformer = new PhiKeyManagedTransformer(TEST_DEK, true);
    const randTransformer = new PhiKeyManagedTransformer(TEST_DEK, false);

    it('deterministic and randomised modes produce different ciphertexts for same input', () => {
      const input = 'test-value-123';
      const detOut = detTransformer.to(input);
      const randOut = randTransformer.to(input);
      expect(detOut).not.toEqual(randOut);
    });

    it('all PHI markers absent from every raw column value', () => {
      const values = [
        '123-45-6789',
        'John Doe - Prescription Notes',
        'lisinopril 10mg daily',
        'prescription details for patient',
      ];

      const allRaw = values.map((v) => transformerForMode(v).to(v));

      function transformerForMode(val: string): PhiKeyManagedTransformer {
        // Use deterministic for short coded values, randomised for free text
        return val.length < 20 ? detTransformer : randTransformer;
      }

      HMAC_PLAINTEXT_MARKERS.forEach((marker) => {
        allRaw.forEach((raw) => {
          expect(raw).not.toContain(marker);
        });
      });
    });
  });

  describe('constructor validation', () => {
    it('throws when DEK is not 32 bytes', () => {
      expect(() => new PhiKeyManagedTransformer(Buffer.alloc(16))).toThrow('DEK must be 32 bytes');
    });

    it('accepts exactly 32 bytes', () => {
      expect(() => new PhiKeyManagedTransformer(randomBytes(32))).not.toThrow();
    });
  });
});