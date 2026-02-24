import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddQueryProfilingIndexes1740500000000 implements MigrationInterface {
  name = 'AddQueryProfilingIndexes1740500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Issue #153 acceptance indexes across mixed naming conventions.
    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public.medical_records') IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'medical_records'
              AND column_name IN ('patientId', 'patient_id')
          ) THEN
          IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'medical_records'
              AND column_name = 'patientId'
          ) THEN
            EXECUTE 'CREATE INDEX IF NOT EXISTS "IDX_medical_records_patient_id" ON "medical_records" ("patientId")';
          ELSE
            EXECUTE 'CREATE INDEX IF NOT EXISTS "IDX_medical_records_patient_id" ON "medical_records" ("patient_id")';
          END IF;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public.access_grants') IS NOT NULL THEN
          IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'access_grants'
              AND column_name IN ('patientId', 'patient_id')
          )
          AND EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'access_grants'
              AND column_name IN ('granteeId', 'grantee_id')
          )
          AND EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'access_grants'
              AND column_name IN ('expiresAt', 'expires_at')
          ) THEN
            IF EXISTS (
              SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'access_grants'
                AND column_name = 'patientId'
            ) THEN
              EXECUTE 'CREATE INDEX IF NOT EXISTS "IDX_access_grants_patient_grantee_expires" ON "access_grants" ("patientId", "granteeId", "expiresAt")';
            ELSE
              EXECUTE 'CREATE INDEX IF NOT EXISTS "IDX_access_grants_patient_grantee_expires" ON "access_grants" ("patient_id", "grantee_id", "expires_at")';
            END IF;
          END IF;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public.audit_logs') IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'audit_logs'
              AND column_name IN ('userId', 'user_id')
          )
          AND EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'audit_logs'
              AND column_name IN ('timestamp', 'createdAt', 'created_at')
          ) THEN
          IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'audit_logs'
              AND column_name = 'user_id'
          ) THEN
            EXECUTE 'CREATE INDEX IF NOT EXISTS "IDX_audit_logs_user_id_timestamp" ON "audit_logs" ("user_id", "timestamp")';
          ELSIF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'audit_logs'
              AND column_name = 'createdAt'
          ) THEN
            EXECUTE 'CREATE INDEX IF NOT EXISTS "IDX_audit_logs_user_id_timestamp" ON "audit_logs" ("userId", "createdAt" DESC)';
          ELSE
            EXECUTE 'CREATE INDEX IF NOT EXISTS "IDX_audit_logs_user_id_timestamp" ON "audit_logs" ("userId", "created_at" DESC)';
          END IF;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public.audit_logs') IS NOT NULL THEN
          IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'audit_logs'
              AND column_name = 'entity_id'
          ) THEN
            EXECUTE 'CREATE INDEX IF NOT EXISTS "IDX_audit_logs_entity_id" ON "audit_logs" ("entity_id")';
          ELSIF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'audit_logs'
              AND column_name = 'entityId'
          ) THEN
            EXECUTE 'CREATE INDEX IF NOT EXISTS "IDX_audit_logs_entity_id" ON "audit_logs" ("entityId")';
          END IF;
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
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_audit_logs_entity_id";');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_audit_logs_user_id_timestamp";');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_access_grants_patient_grantee_expires";');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_medical_records_patient_id";');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_patients_userId";');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_medical_history_patientId_eventDate_desc";');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_medical_records_providerId_createdAt_desc";');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_audit_logs_patientIdHash_createdAt_desc";');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_audit_logs_userId_createdAt_desc";');
  }
}
