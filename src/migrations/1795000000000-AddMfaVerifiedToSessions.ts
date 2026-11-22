import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Expand migration (#1322): record whether a session has completed an MFA
 * challenge so token refresh can preserve that state instead of re-deriving
 * it from the account-level `users.mfaEnabled` flag.
 *
 * Existing sessions default to `false`, i.e. not MFA-verified. Holders of
 * those sessions must re-verify via POST /auth/mfa/verify-code to regain
 * access to MFA-gated routes.
 */
export class AddMfaVerifiedToSessions1795000000000 implements MigrationInterface {
  name = 'AddMfaVerifiedToSessions1795000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('sessions'))) return;

    await queryRunner.query(`
      ALTER TABLE "sessions"
        ADD COLUMN IF NOT EXISTS "mfaVerified" boolean NOT NULL DEFAULT false
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('sessions'))) return;

    await queryRunner.query(`
      ALTER TABLE "sessions"
        DROP COLUMN IF EXISTS "mfaVerified"
    `);
  }
}
