import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProviderAvailabilityCapacity1772800000000 implements MigrationInterface {
    name = 'AddProviderAvailabilityCapacity1772800000000';
    public transaction = false;

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add provider capacity columns to users table
        await queryRunner.query(
            `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "maxPatients" integer DEFAULT 0`,
        );
        await queryRunner.query(
            `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "currentPatients" integer DEFAULT 0`,
        );
        await queryRunner.query(
            `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "specializations" text[] DEFAULT '{}'`,
        );

        // Create provider_availability table for tracking availability status
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "provider_availability" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "providerId" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "isAcceptingPatients" boolean NOT NULL DEFAULT true,
        "maxPatients" integer NOT NULL DEFAULT 0,
        "currentPatients" integer NOT NULL DEFAULT 0,
        "specializations" text[] DEFAULT '{}',
        "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE("providerId")
      )
    `);

        // Create index for provider lookups
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_provider_availability_providerId" ON "provider_availability"("providerId")`,
        );

        // Create index for accepting patients filter
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_provider_availability_isAcceptingPatients" ON "provider_availability"("isAcceptingPatients")`,
        );

        // Create index for specializations search
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_provider_availability_specializations" ON "provider_availability" USING GIN("specializations")`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "provider_availability"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "specializations"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "currentPatients"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "maxPatients"`);
    }
}
