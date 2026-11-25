import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRecordAnchorStatus1797000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "records_anchorstatus_enum" AS ENUM ('PENDING', 'CONFIRMED', 'FAILED')`,
    );
    await queryRunner.query(
      `ALTER TABLE "records" ADD "anchorStatus" "records_anchorstatus_enum" NOT NULL DEFAULT 'PENDING'`,
    );
    await queryRunner.query(
      `ALTER TABLE "records" ADD "anchorConfirmedAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_records_anchorStatus" ON "records" ("anchorStatus")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_records_anchorStatus"`);
    await queryRunner.query(`ALTER TABLE "records" DROP COLUMN "anchorConfirmedAt"`);
    await queryRunner.query(`ALTER TABLE "records" DROP COLUMN "anchorStatus"`);
    await queryRunner.query(`DROP TYPE "records_anchorstatus_enum"`);
  }
}
