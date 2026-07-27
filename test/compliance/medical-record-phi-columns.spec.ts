/**
 * Compliance Test: Medical Record PHI Column Encryption
 *
 * Verifies that the TypeORM ValueTransformers on MedicalRecord encrypt PHI
 * before writing to the database and that raw column values are never plaintext.
 *
 * These tests operate at the transformer layer (unit-level) — no live DB
 * connection required. They simulate what TypeORM does: call transformer.to()
 * on write and transformer.from() on read, then assert the stored value is
 * opaque ciphertext.
 *
 * HIPAA reference: 45 CFR § 164.312(a)(2)(iv) — Encryption and Decryption.
 */

import { PhiGcmTransformer } from '../../src/common/transformers/phi-gcm.transformer';
import { PhiDeterministicTransformer } from '../../src/common/transformers/phi-deterministic.transformer';

// Representative PHI values that must never appear in raw column storage
const PHI_SAMPLES = {
  title: 'Annual Physical Examination - John Doe',
  description: 'Patient presented with chest pain and shortness of breath.',
  notes: 'Prescribed lisinopril 10mg. Follow-up in 4 weeks.',
  diagnosis: 'I10,J45.20',   // ICD-10 codes
  tags: 'hypertension,asthma',
};

// Regex that matches a valid base64 ciphertext (no raw ASCII PHI words)
const BASE64_RE = /^[A-Za-z0-9+/]+=*$/;

// Known plaintext substrings that must NOT appear in the encrypted column value
const PLAINTEXT_MARKERS = [
  'John Doe',
  'chest pain',
  'lisinopril',
  'I10',
  'J45',
  'hypertension',
  'asthma',
  'Annual Physical',
  'shortness',
  'Prescribed',
];

describe('Medical Record PHI Column Encryption Compliance', () => {
  let gcm: PhiGcmTransformer;
  let det: PhiDeterministicTransformer;

  beforeAll(() => {
    // Provide a test key — same format as production ENCRYPTION_KEY
    process.env.ENCRYPTION_KEY =
      'a'.repeat(64); // 64 hex chars = 32 bytes when used as string key
    gcm = new PhiGcmTransformer();
    det = new PhiDeterministicTransformer();
  });

  afterAll(() => {
    delete process.env.ENCRYPTION_KEY;
  });

  // ── GCM transformer (title, description, notes) ───────────────────────────

  describe('PhiGcmTransformer (randomised AES-256-GCM)', () => {
    it('encrypts title to opaque base64 — no plaintext PHI in raw column value', () => {
      const raw = gcm.to(PHI_SAMPLES.title);
      expect(raw).not.toBeNull();
      expect(BASE64_RE.test(raw!)).toBe(true);
      expect(raw).not.toContain('John Doe');
      expect(raw).not.toContain('Annual Physical');
    });

    it('encrypts description to opaque base64 — no plaintext PHI in raw column value', () => {
      const raw = gcm.to(PHI_SAMPLES.description);
      expect(raw).not.toBeNull();
      expect(BASE64_RE.test(raw!)).toBe(true);
      PLAINTEXT_MARKERS.forEach((marker) => {
        expect(raw).not.toContain(marker);
      });
    });

    it('encrypts notes to opaque base64 — no plaintext PHI in raw column value', () => {
      const raw = gcm.to(PHI_SAMPLES.notes);
      expect(raw).not.toBeNull();
      expect(BASE64_RE.test(raw!)).toBe(true);
      expect(raw).not.toContain('lisinopril');
    });

    it('produces different ciphertext on each write (randomised IV)', () => {
      const a = gcm.to(PHI_SAMPLES.title);
      const b = gcm.to(PHI_SAMPLES.title);
      expect(a).not.toEqual(b);
    });

    it('round-trips correctly: decrypt(encrypt(x)) === x', () => {
      const encrypted = gcm.to(PHI_SAMPLES.description);
      const decrypted = gcm.from(encrypted);
      expect(decrypted).toBe(PHI_SAMPLES.description);
    });

    it('returns null for null input (no crash on empty column)', () => {
      expect(gcm.to(null)).toBeNull();
      expect(gcm.from(null)).toBeNull();
    });

    it('returns null for undefined input', () => {
      expect(gcm.to(undefined)).toBeNull();
      expect(gcm.from(undefined)).toBeNull();
    });

    it('returns null on tampered ciphertext (auth tag failure)', () => {
      const encrypted = gcm.to(PHI_SAMPLES.notes)!;
      // Flip a byte in the ciphertext portion
      const buf = Buffer.from(encrypted, 'base64');
      buf[buf.length - 1] ^= 0xff;
      const tampered = buf.toString('base64');
      expect(gcm.from(tampered)).toBeNull();
    });
  });

  // ── Deterministic transformer (diagnosis, tags) ───────────────────────────

  describe('PhiDeterministicTransformer (deterministic AES-256-GCM)', () => {
    it('encrypts diagnosis codes to opaque base64 — no plaintext ICD codes in raw column', () => {
      const raw = det.to(PHI_SAMPLES.diagnosis);
      expect(raw).not.toBeNull();
      expect(BASE64_RE.test(raw!)).toBe(true);
      expect(raw).not.toContain('I10');
      expect(raw).not.toContain('J45');
    });

    it('encrypts tags to opaque base64 — no plaintext condition names in raw column', () => {
      const raw = det.to(PHI_SAMPLES.tags);
      expect(raw).not.toBeNull();
      expect(BASE64_RE.test(raw!)).toBe(true);
      expect(raw).not.toContain('hypertension');
      expect(raw).not.toContain('asthma');
    });

    it('produces identical ciphertext for identical input (searchable index)', () => {
      const a = det.to(PHI_SAMPLES.diagnosis);
      const b = det.to(PHI_SAMPLES.diagnosis);
      expect(a).toEqual(b);
    });

    it('produces different ciphertext for different inputs', () => {
      const a = det.to('I10');
      const b = det.to('J45.20');
      expect(a).not.toEqual(b);
    });

    it('round-trips correctly: decrypt(encrypt(x)) === x', () => {
      const encrypted = det.to(PHI_SAMPLES.tags);
      const decrypted = det.from(encrypted);
      expect(decrypted).toBe(PHI_SAMPLES.tags);
    });

    it('returns null for null input', () => {
      expect(det.to(null)).toBeNull();
      expect(det.from(null)).toBeNull();
    });

    it('returns null on tampered ciphertext', () => {
      const encrypted = det.to(PHI_SAMPLES.diagnosis)!;
      const buf = Buffer.from(encrypted, 'base64');
      buf[buf.length - 1] ^= 0xff;
      expect(det.from(buf.toString('base64'))).toBeNull();
    });
  });

  // ── Cross-field isolation ─────────────────────────────────────────────────

  describe('Cross-field isolation', () => {
    it('GCM and deterministic transformers produce different ciphertexts for same input', () => {
      const input = 'I10';
      const gcmOut = gcm.to(input);
      const detOut = det.to(input);
      expect(gcmOut).not.toEqual(detOut);
    });

    it('all PHI sample fields produce non-empty ciphertext', () => {
      Object.entries(PHI_SAMPLES).forEach(([field, value]) => {
        const transformer = ['diagnosis', 'tags'].includes(field) ? det : gcm;
        const raw = transformer.to(value);
        expect(raw).not.toBeNull();
        expect(raw!.length).toBeGreaterThan(0);
      });
    });

    it('no PHI marker appears in any raw column value', () => {
      const allRaw = [
        gcm.to(PHI_SAMPLES.title),
        gcm.to(PHI_SAMPLES.description),
        gcm.to(PHI_SAMPLES.notes),
        det.to(PHI_SAMPLES.diagnosis),
        det.to(PHI_SAMPLES.tags),
      ];

      PLAINTEXT_MARKERS.forEach((marker) => {
        allRaw.forEach((raw) => {
          expect(raw).not.toContain(marker);
        });
      });
    });
  });
});
