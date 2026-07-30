import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNotificationOutboxTable1775200000000
  implements MigrationInterface
{
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "notification_outbox_status_enum"
        AS ENUM ('pending', 'processing', 'completed', 'failed')
    `);

    await queryRunner.query(`
      CREATE TABLE "notification_outbox" (
        "id"               uuid                                  NOT NULL DEFAULT gen_random_uuid(),
        "dedupe_key"       character varying                     NOT NULL,
        "payload"          jsonb                                 NOT NULL,
        "patient_id"       character varying                     NOT NULL,
        "status"           "notification_outbox_status_enum"     NOT NULL DEFAULT 'pending',
        "attempts"         integer                               NOT NULL DEFAULT 0,
        "max_attempts"     integer                               NOT NULL DEFAULT 5,
        "next_attempt_at"  timestamp with time zone,
        "last_error"       text,
        "created_at"       timestamp with time zone              NOT NULL DEFAULT now(),
        "updated_at"       timestamp with time zone              NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notification_outbox" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_notification_outbox_dedupe_key" UNIQUE ("dedupe_key")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_notification_outbox_status"
        ON "notification_outbox" ("status")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_notification_outbox_next_attempt_at"
        ON "notification_outbox" ("next_attempt_at")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_notification_outbox_patient_id"
        ON "notification_outbox" ("patient_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_notification_outbox_dedupe_key"
        ON "notification_outbox" ("dedupe_key")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "notification_outbox"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "notification_outbox_status_enum"`,
    );
  }
}
