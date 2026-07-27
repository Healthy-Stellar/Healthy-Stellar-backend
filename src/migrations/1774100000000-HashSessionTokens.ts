import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

/**
 * Migration: Hash Session Tokens (Issue #348)
 *
 * Replaces plain-text accessToken / refreshToken columns in the sessions table
 * with SHA-256 hash columns (accessTokenHash / refreshTokenHash).
 *
 * Deployment strategy:
 *   - Existing active sessions are truncated because the raw tokens are no
 *     longer available to re-hash; affected users will simply be asked to
 *     log in again (one-time forced re-authentication).
 *   - The old varchar(500) columns are dropped and replaced with char(64)
 *     columns (hex-encoded SHA-256 is always exactly 64 characters).
 *   - Unique indexes are recreated on the new columns.
 */
export class HashSessionTokens1774100000000 implements MigrationInterface {
  name = 'HashSessionTokens1774100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ------------------------------------------------------------------ //
    // 1. Truncate all existing sessions — raw tokens cannot be re-hashed. //
    //    Users will be required to log in again after this deployment.     //
    // ------------------------------------------------------------------ //
    await queryRunner.query(`TRUNCATE TABLE sessions`);

    // ------------------------------------------------------------------ //
    // 2. Drop old indexes that reference the plain-text columns.           //
    // ------------------------------------------------------------------ //
    await queryRunner.dropIndex('sessions', 'IDX_sessions_refreshToken').catch(() => {
      // Index may not exist in all environments — safe to ignore.
    });

    // ------------------------------------------------------------------ //
    // 3. Drop the old plain-text columns.                                  //
    // ------------------------------------------------------------------ //
    await queryRunner.dropColumn('sessions', 'refreshToken');
    await queryRunner.dropColumn('sessions', 'accessToken');

    // ------------------------------------------------------------------ //
    // 4. Add the new hash columns (char(64) — SHA-256 hex digest).         //
    // ------------------------------------------------------------------ //
    await queryRunner.addColumn(
      'sessions',
      new TableColumn({
        name: 'refreshTokenHash',
        type: 'char',
        length: '64',
        isUnique: true,
        isNullable: false,
        default: "'0000000000000000000000000000000000000000000000000000000000000000'",
      }),
    );

    await queryRunner.addColumn(
      'sessions',
      new TableColumn({
        name: 'accessTokenHash',
        type: 'char',
        length: '64',
        isUnique: true,
        isNullable: false,
        default: "'0000000000000000000000000000000000000000000000000000000000000000'",
      }),
    );

    // ------------------------------------------------------------------ //
    // 5. Remove the temporary defaults (not needed after table is empty).  //
    // ------------------------------------------------------------------ //
    await queryRunner.query(`ALTER TABLE sessions ALTER COLUMN "refreshTokenHash" DROP DEFAULT`);
    await queryRunner.query(`ALTER TABLE sessions ALTER COLUMN "accessTokenHash" DROP DEFAULT`);

    // ------------------------------------------------------------------ //
    // 6. Create indexes on the new hash columns for fast lookups.          //
    // ------------------------------------------------------------------ //
    await queryRunner.createIndex(
      'sessions',
      new TableIndex({
        name: 'IDX_sessions_refreshTokenHash',
        columnNames: ['refreshTokenHash'],
      }),
    );

    await queryRunner.createIndex(
      'sessions',
      new TableIndex({
        name: 'IDX_sessions_accessTokenHash',
        columnNames: ['accessTokenHash'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Restore plain-text columns (data loss is expected — sessions were truncated).
    await queryRunner.dropIndex('sessions', 'IDX_sessions_accessTokenHash').catch(() => {});
    await queryRunner.dropIndex('sessions', 'IDX_sessions_refreshTokenHash').catch(() => {});

    await queryRunner.dropColumn('sessions', 'accessTokenHash');
    await queryRunner.dropColumn('sessions', 'refreshTokenHash');

    await queryRunner.addColumn(
      'sessions',
      new TableColumn({
        name: 'refreshToken',
        type: 'varchar',
        length: '500',
        isUnique: true,
        isNullable: false,
        default: "''",
      }),
    );

    await queryRunner.addColumn(
      'sessions',
      new TableColumn({
        name: 'accessToken',
        type: 'varchar',
        length: '500',
        isUnique: true,
        isNullable: false,
        default: "''",
      }),
    );

    await queryRunner.query(`ALTER TABLE sessions ALTER COLUMN "refreshToken" DROP DEFAULT`);
    await queryRunner.query(`ALTER TABLE sessions ALTER COLUMN "accessToken" DROP DEFAULT`);

    await queryRunner.createIndex(
      'sessions',
      new TableIndex({
        name: 'IDX_sessions_refreshToken',
        columnNames: ['refreshToken'],
      }),
    );
  }
}
