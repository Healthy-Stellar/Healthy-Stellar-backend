import { MigrationInterface, QueryRunner } from 'typeorm';
import { createCipheriv, createDecipheriv, createHmac, randomBytes, scryptSync } from 'crypto';

/**
 * Migration: Encrypt PHI metadata fields on medical_records
 *
 * Adds diagnosis, tags, notes columns (text) and encrypts existing plaintext
 * values in title and description in batches of 500 rows.
 *
 * Rollback (down): decrypts all rows back to plaintext and drops the new columns.
 *
 * Encryption schemes:
 *  - title, description, notes  → randomised AES-256-GCM  (PhiGcmTransformer)
 *  - diagnosis, tags             → deterministic AES-256-GCM (PhiDeterministicTransformer)
 */
export class EncryptMedicalRecordPhiFields1774100000000 implements MigrationInterface {
  private readonly BATCH = 500;

  // ── Key derivation ────────────────────────────────────────────────────────

  private gcmKey(salt: Buffer): Buffer {
    return scryptSync(this.encKey(), salt, 32) as Buffer;
  }

  private get deterministicKey(): Buffer {
    return scryptSync(this.encKey(), 'phi-deterministic-v1', 32) as Buffer;
  }

  private encKey(): string {
    const k = process.env.ENCRYPTION_KEY;
    if (!k) throw new Error('ENCRYPTION_KEY must be set before running this migration');
    return k;
  }

  // ── Encryption helpers ────────────────────────────────────────────────────

  private encryptGcm(plaintext: string): string {
    const salt = randomBytes(16);
    const iv = randomBytes(12);
    const dk = this.gcmKey(salt);
    const cipher = createCipheriv('aes-256-gcm', dk, iv);
    const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([salt, iv, tag, ct]).toString('base64');
  }

  private decryptGcm(ciphertext: string): string {
    const buf = Buffer.from(ciphertext, 'base64');
    const salt = buf.subarray(0, 16);
    const iv = buf.subarray(16, 28);
    const tag = buf.subarray(28, 44);
    const ct = buf.subarray(44);
    const dk = this.gcmKey(salt);
    const decipher = createDecipheriv('aes-256-gcm', dk, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
  }

  private encryptDeterministic(plaintext: string): string {
    const dk = this.deterministicKey;
    const iv = createHmac('sha256', dk).update(plaintext, 'utf8').digest().subarray(0, 12);
    const cipher = createCipheriv('aes-256-gcm', dk, iv);
    const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, ct]).toString('base64');
  }

  private decryptDeterministic(ciphertext: string): string {
    const buf = Buffer.from(ciphertext, 'base64');
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const ct = buf.subarray(28);
    const dk = this.deterministicKey;
    const decipher = createDecipheriv('aes-256-gcm', dk, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  /** Returns true if the value looks like a base64-encoded ciphertext (already encrypted). */
  private isEncrypted(value: string): boolean {
    if (!value) return false;
    try {
      const buf = Buffer.from(value, 'base64');
      // Minimum size: salt(16)+iv(12)+tag(16)+1 byte ct = 45 bytes
      return buf.length >= 45 && Buffer.from(buf.toString('base64')).equals(buf);
    } catch {
      return false;
    }
  }

  // ── up ────────────────────────────────────────────────────────────────────

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add new PHI columns (nullable text)
    await queryRunner.query(`
      ALTER TABLE medical_records
        ADD COLUMN IF NOT EXISTS diagnosis text,
        ADD COLUMN IF NOT EXISTS tags      text,
        ADD COLUMN IF NOT EXISTS notes     text
    `);

    // 2. Encrypt existing rows in batches
    let offset = 0;
    while (true) {
      const rows: Array<{ id: string; title: string | null; description: string | null }> =
        await queryRunner.query(
          `SELECT id, title, description FROM medical_records ORDER BY id LIMIT $1 OFFSET $2`,
          [this.BATCH, offset],
        );

      if (rows.length === 0) break;

      for (const row of rows) {
        const updates: string[] = [];
        const params: unknown[] = [];
        let idx = 1;

        if (row.title && !this.isEncrypted(row.title)) {
          updates.push(`title = $${idx++}`);
          params.push(this.encryptGcm(row.title));
        }

        if (row.description && !this.isEncrypted(row.description)) {
          updates.push(`description = $${idx++}`);
          params.push(this.encryptGcm(row.description));
        }

        if (updates.length > 0) {
          params.push(row.id);
          await queryRunner.query(
            `UPDATE medical_records SET ${updates.join(', ')} WHERE id = $${idx}`,
            params,
          );
        }
      }

      offset += rows.length;
      if (rows.length < this.BATCH) break;
    }
  }

  // ── down (rollback) ───────────────────────────────────────────────────────

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Decrypt title and description back to plaintext in batches
    let offset = 0;
    while (true) {
      const rows: Array<{ id: string; title: string | null; description: string | null }> =
        await queryRunner.query(
          `SELECT id, title, description FROM medical_records ORDER BY id LIMIT $1 OFFSET $2`,
          [this.BATCH, offset],
        );

      if (rows.length === 0) break;

      for (const row of rows) {
        const updates: string[] = [];
        const params: unknown[] = [];
        let idx = 1;

        if (row.title && this.isEncrypted(row.title)) {
          try {
            updates.push(`title = $${idx++}`);
            params.push(this.decryptGcm(row.title));
          } catch {
            // Leave as-is if decryption fails (already plaintext or corrupt)
          }
        }

        if (row.description && this.isEncrypted(row.description)) {
          try {
            updates.push(`description = $${idx++}`);
            params.push(this.decryptGcm(row.description));
          } catch {
            // Leave as-is
          }
        }

        if (updates.length > 0) {
          params.push(row.id);
          await queryRunner.query(
            `UPDATE medical_records SET ${updates.join(', ')} WHERE id = $${idx}`,
            params,
          );
        }
      }

      offset += rows.length;
      if (rows.length < this.BATCH) break;
    }

    // 2. Drop the new columns
    await queryRunner.query(`
      ALTER TABLE medical_records
        DROP COLUMN IF EXISTS diagnosis,
        DROP COLUMN IF EXISTS tags,
        DROP COLUMN IF EXISTS notes
    `);
  }
}
