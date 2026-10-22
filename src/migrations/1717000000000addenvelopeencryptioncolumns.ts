import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

/**
 * Migration: Add envelope-encryption columns to medical_attachments
 *             and create the tenants table.
 *
 * Run:   npm run migration:run
 * Revert: npm run migration:revert
 */
export class AddEnvelopeEncryptionColumns1717000000000
  implements MigrationInterface
{
  name = 'AddEnvelopeEncryptionColumns1717000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. Create tenants table ───────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tenants" (
        "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "name"           VARCHAR NOT NULL UNIQUE,
        "kek_arn"        TEXT,
        "kek_version"    VARCHAR(64),
        "kek_rotated_at" TIMESTAMPTZ,
        "created_at"     TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at"     TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    // ── 2. Add envelope-encryption columns to medical_attachments ────────────
    const attachmentColumns: TableColumn[] = [
      new TableColumn({
        name: 'encrypted_dek',
        type: 'text',
        isNullable: true,
        comment:
          'Base64-encoded KMS-wrapped data-encryption key for this file',
      }),
      new TableColumn({
        name: 'kek_arn',
        type: 'text',
        isNullable: true,
        comment: 'KMS CMK ARN used to wrap the DEK at upload time',
      }),
      new TableColumn({
        name: 'kek_version',
        type: 'varchar',
        length: '64',
        isNullable: true,
        comment:
          'Version label of the KEK at upload / re-wrap time (e.g. v1717000000000)',
      }),
      new TableColumn({
        name: 'iv',
        type: 'text',
        isNullable: true,
        comment: 'Base64-encoded 12-byte AES-256-GCM initialisation vector',
      }),
      new TableColumn({
        name: 'auth_tag',
        type: 'text',
        isNullable: true,
        comment: 'Base64-encoded 16-byte AES-256-GCM authentication tag',
      }),
      new TableColumn({
        name: 'tenant_id',
        type: 'uuid',
        isNullable: true,
      }),
    ];

    for (const col of attachmentColumns) {
      const exists = await queryRunner.hasColumn('medical_attachments', col.name);
      if (!exists) {
        await queryRunner.addColumn('medical_attachments', col);
      }
    }

    // ── 3. Indexes ─────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_medical_attachments_kek_version"
        ON "medical_attachments" ("kek_version")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_medical_attachments_tenant_id"
        ON "medical_attachments" ("tenant_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_medical_attachments_kek_version"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_medical_attachments_tenant_id"`,
    );

    for (const col of [
      'encrypted_dek',
      'kek_arn',
      'kek_version',
      'iv',
      'auth_tag',
      'tenant_id',
    ]) {
      const exists = await queryRunner.hasColumn('medical_attachments', col);
      if (exists) {
        await queryRunner.dropColumn('medical_attachments', col);
      }
    }

    await queryRunner.query(`DROP TABLE IF EXISTS "tenants"`);
  }
}