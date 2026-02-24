import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddQueryProfilingIndexes1740500000000 implements MigrationInterface {
  name = 'AddQueryProfilingIndexes1740500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public.audit_logs') IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'audit_logs'
              AND column_name = 'userId'
          )
          AND EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'audit_logs'
              AND column_name = 'createdAt'
          ) THEN
          EXECUTE 'CREATE INDEX IF NOT EXISTS "IDX_audit_logs_userId_createdAt_desc" ON "audit_logs" ("userId", "createdAt" DESC)';
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public.audit_logs') IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'audit_logs'
              AND column_name = 'patientIdHash'
          )
          AND EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'audit_logs'
              AND column_name = 'createdAt'
          ) THEN
          EXECUTE 'CREATE INDEX IF NOT EXISTS "IDX_audit_logs_patientIdHash_createdAt_desc" ON "audit_logs" ("patientIdHash", "createdAt" DESC)';
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public.medical_records') IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'medical_records'
              AND column_name = 'providerId'
          )
          AND EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'medical_records'
              AND column_name = 'createdAt'
          ) THEN
          EXECUTE 'CREATE INDEX IF NOT EXISTS "IDX_medical_records_providerId_createdAt_desc" ON "medical_records" ("providerId", "createdAt" DESC)';
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public.medical_history') IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'medical_history'
              AND column_name = 'patientId'
          )
          AND EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'medical_history'
              AND column_name = 'eventDate'
          ) THEN
          EXECUTE 'CREATE INDEX IF NOT EXISTS "IDX_medical_history_patientId_eventDate_desc" ON "medical_history" ("patientId", "eventDate" DESC)';
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public.patients') IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'patients'
              AND column_name = 'userId'
          ) THEN
          EXECUTE 'CREATE INDEX IF NOT EXISTS "IDX_patients_userId" ON "patients" ("userId")';
        END IF;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_patients_userId";');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_medical_history_patientId_eventDate_desc";');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_medical_records_providerId_createdAt_desc";');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_audit_logs_patientIdHash_createdAt_desc";');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_audit_logs_userId_createdAt_desc";');
  }
}
