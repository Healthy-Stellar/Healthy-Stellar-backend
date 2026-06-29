import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBedOccupancyTables1776300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "wards" (
        "id"            UUID          NOT NULL DEFAULT gen_random_uuid(),
        "name"          VARCHAR       NOT NULL,
        "wardManagerId" UUID,
        "isActive"      BOOLEAN       NOT NULL DEFAULT true,
        CONSTRAINT "PK_wards" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "rooms" (
        "id"         UUID    NOT NULL DEFAULT gen_random_uuid(),
        "wardId"     UUID    NOT NULL,
        "roomNumber" VARCHAR NOT NULL,
        "isActive"   BOOLEAN NOT NULL DEFAULT true,
        CONSTRAINT "PK_rooms" PRIMARY KEY ("id"),
        CONSTRAINT "FK_rooms_ward" FOREIGN KEY ("wardId")
          REFERENCES "wards" ("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TYPE IF NOT EXISTS "bed_status_enum"
        AS ENUM ('available', 'occupied', 'reserved', 'maintenance', 'cleaning')
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "beds" (
        "id"          UUID              NOT NULL DEFAULT gen_random_uuid(),
        "bedNumber"   VARCHAR           NOT NULL,
        "status"      "bed_status_enum" NOT NULL DEFAULT 'available',
        "roomId"      UUID              NOT NULL,
        "patientId"   UUID,
        "assignedAt"  TIMESTAMP,
        "features"    TEXT[],
        "isActive"    BOOLEAN           NOT NULL DEFAULT true,
        "createdAt"   TIMESTAMP         NOT NULL DEFAULT now(),
        "updatedAt"   TIMESTAMP         NOT NULL DEFAULT now(),
        CONSTRAINT "PK_beds" PRIMARY KEY ("id"),
        CONSTRAINT "FK_beds_room" FOREIGN KEY ("roomId")
          REFERENCES "rooms" ("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_beds_roomId" ON "beds" ("roomId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_beds_status" ON "beds" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_beds_patientId" ON "beds" ("patientId") WHERE "patientId" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_beds_patientId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_beds_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_beds_roomId"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "beds"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "bed_status_enum"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "rooms"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "wards"`);
  }
}
