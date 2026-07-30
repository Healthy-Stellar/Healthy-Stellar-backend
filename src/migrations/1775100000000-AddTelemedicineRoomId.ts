import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTelemedicineRoomId1775100000000 implements MigrationInterface {
  name = 'AddTelemedicineRoomId1775100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "telemedicine_room_id" uuid`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_appointments_telemedicine_room_id"
       ON "appointments" ("telemedicine_room_id")
       WHERE "telemedicine_room_id" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_appointments_telemedicine_room_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "appointments" DROP COLUMN IF EXISTS "telemedicine_room_id"`,
    );
  }
}
