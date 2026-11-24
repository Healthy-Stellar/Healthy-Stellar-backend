import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPendingChainGrantStatus1796000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "access_grants_status_enum" ADD VALUE IF NOT EXISTS 'PENDING_CHAIN'`,
    );
  }

  public async down(): Promise<void> {
    // PostgreSQL does not support removing an enum value.
  }
}
