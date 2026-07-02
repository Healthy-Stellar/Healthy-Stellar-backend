import { MigrationInterface, QueryRunner } from 'typeorm';
import {
  assertTableExists,
  createIndexConcurrently,
  dropIndexConcurrently,
} from '../common/utils/migration-safety.util';

/**
 * Migration: Appointment booking conflict prevention with configurable
 * buffer time + database-level locking.
 *
 * Why this migration
 * -------------------
 * The historical `@Unique('UQ_appointments_doctor_time', ['doctorId', 'startTime', 'endTime'])`
 * constraint on the `Appointment` entity blocks only EXACT collisions on
 * (doctorId, startTime, endTime). It is too narrow to express
 *
 *   1. overlapping but not identical time ranges;
 *   2. room conflicts (no roomId column at all);
 *   3. the configurable buffer-time "cleanup gap" between appointments.
 *
 * The new AppointmentService.create() flow protects against all three
 * scenarios transactionally via
 *
 *   - pg_advisory_xact_lock(hashtext('appt:provider:<doctorId>')) +
 *     optionally pg_advisory_xact_lock(hashtext('appt:room:<roomId>'));
 *   - a buffered overlap SELECT (start_time < (req.end + buffer)
 *                                AND end_time   > (req.start - buffer));
 *   - a SELECT ... FOR UPDATE on the matching rows, kept as defense in
 *     depth and as the only synchronization primitive on DBMs that don't
 *     expose pg_advisory_xact_lock (e.g. the SQLite harness used by some
 *     unit tests).
 *
 * For those guarantees to work we therefore need:
 *
 *   - the narrow unique constraint dropped (it forces inserting zero-length
 *     back-to-back appointments to collide, which is precisely the kind of
 *     double-booking the new logic is meant to permit/reject via the buffer
 *     policy, not via a hard unique key);
 *   - a nullable `room_id` uuid column on `appointments`;
 *   - supporting indexes that the buffered range-overlap queries
 *     (covering `(tenant_id, doctor_id, room_id, start_time, end_time)`)
 *     can use to stay sub-linear under booking load.
 *
 * Idempotency: every statement uses `IF [NOT] EXISTS` / `IF EXISTS` so the
 * migration can be re-run against a partially-applied schema without
 * failing a deploy. Index creation is delegated to the project's shared
 * `createIndexConcurrently` helper from
 * src/common/utils/migration-safety.util.ts so we follow the same
 * online-migration pattern as 1782570000000-AddQueryPerformanceProfilingIndexes.
 */
export class AppointmentBookingConflictPrevention1782900000000
  implements MigrationInterface
{
  name = 'AppointmentBookingConflictPrevention1782900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await this.tableExists(queryRunner, 'appointments'))) {
      // Minimal / test schemas without the appointments table — nothing to do.
      return;
    }

    // 1) Drop the narrow exact-time unique constraint. The new
    //    advisory-lock + buffered-overlap flow in
    //    AppointmentService.create() is the single source of truth for
    //    booking conflict prevention, and that flow requires liberty to
    //    insert back-to-back appointments unless the buffer policy says
    //    otherwise.
    await queryRunner.query(
      `ALTER TABLE "appointments" DROP CONSTRAINT IF EXISTS "UQ_appointments_doctor_time"`,
    );

    // 2) Optional physical-room assignment. Nullable on purpose: many
    //    appointments (telemedicine, walk-in) don't tie to a fixed
    //    physical room, and we never want this column to block inserts.
    if (!(await this.columnExists(queryRunner, 'appointments', 'room_id'))) {
      await queryRunner.query(
        `ALTER TABLE "appointments" ADD COLUMN "room_id" uuid`,
      );
    }

    // 3) B-tree index on room_id to accelerate room-overlap checks.
    //    Owned by this migration only — the Appointment entity has no
    //    `@Index` for `room_id`, so re-running `migration:generate` will
    //    not produce a conflicting declaration.
    await assertTableExists(queryRunner, 'appointments');
    await createIndexConcurrently(
      queryRunner,
      'IDX_appointments_room_id',
      'appointments',
      ['room_id'],
    );

    // 4) Composite index supporting the lead-predicate
    //    `(tenant_id, doctor_id, room_id, start_time, end_time)` used by
    //    the buffered range-overlap SELECT. Extended from
    //    1782570000000-AddQueryPerformanceProfilingIndexes's
    //    `IDX_appointments_doctor_start_end` with `tenant_id` (mandatory
    //    leading column under tenant isolation) and `room_id` so it also
    //    accelerates room conflicts.
    await this.createBufferedOverlapIndex(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await this.tableExists(queryRunner, 'appointments'))) {
      return;
    }

    await dropIndexConcurrently(
      queryRunner,
      'appointments',
      'IDX_appointments_tenant_doctor_room_start_end',
    );
    await dropIndexConcurrently(
      queryRunner,
      'appointments',
      'IDX_appointments_room_id',
    );

    // Re-create the original exact-time unique constraint, matching the
    // pre-migration entity decorator. We deliberately guard against
    // duplicate `(doctor_id, start_time, end_time)` rows already present
    // in the database: the new flow permits such rows to exist (it's
    // the buffer policy that decides whether they collide), so eagerly
    // re-adding the constraint at down-time would silently destroy data.
    // If duplicates exist, we log via RAISE NOTICE and skip — operators
    // can clean up out of band.
    await queryRunner.query(
      `DO $$
       DECLARE
         duplicate_count bigint;
       BEGIN
         IF EXISTS (
           SELECT 1 FROM pg_constraint WHERE conname = 'UQ_appointments_doctor_time'
         ) THEN
           RETURN;
         END IF;

         SELECT COUNT(*) INTO duplicate_count
           FROM (
             SELECT "doctor_id", "start_time", "end_time"
             FROM "appointments"
             GROUP BY 1, 2, 3
             HAVING COUNT(*) > 1
           ) dups;

         IF duplicate_count > 0 THEN
           RAISE NOTICE
             'Down-migration of AppointmentBookingConflictPrevention1782900000000 '
             'skipped re-adding UQ_appointments_doctor_time because % duplicate '
             '(doctor_id, start_time, end_time) groups exist after rollback; '
             'reconcile manually.', duplicate_count;
           RETURN;
         END IF;

         ALTER TABLE "appointments"
           ADD CONSTRAINT "UQ_appointments_doctor_time"
           UNIQUE ("doctor_id", "start_time", "end_time");
       END$$`,
    );

    if (await this.columnExists(queryRunner, 'appointments', 'room_id')) {
      await queryRunner.query(`ALTER TABLE "appointments" DROP COLUMN "room_id"`);
    }
  }

  /**
   * Composite index creation is delegated to the shared helper too.
   * We only guard against schema drift by checking that every column in
   * the indexed tuple is actually present — half-creating a composite
   * index against a column that doesn't yet exist would be noisy.
   */
  private async createBufferedOverlapIndex(queryRunner: QueryRunner): Promise<void> {
    const columns = ['tenant_id', 'doctor_id', 'room_id', 'start_time', 'end_time'];
    const existing = await this.filterExistingColumns(
      queryRunner,
      'appointments',
      columns,
    );
    if (existing.length !== columns.length) {
      // Schema drift — silently skip; the per-column indexes from
      // 1782570000000 still cover the most common predicates.
      return;
    }
    await createIndexConcurrently(
      queryRunner,
      'IDX_appointments_tenant_doctor_room_start_end',
      'appointments',
      columns,
    );
  }

  private async columnExists(
    queryRunner: QueryRunner,
    table: string,
    column: string,
  ): Promise<boolean> {
    const rows: Array<{ column_name: string }> = await queryRunner.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
      [table, column],
    );
    return rows.length > 0;
  }

  private async filterExistingColumns(
    queryRunner: QueryRunner,
    table: string,
    columns: string[],
  ): Promise<string[]> {
    const rows: Array<{ column_name: string }> = await queryRunner.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1`,
      [table],
    );
    const existing = new Set(rows.map((row) => row.column_name));
    return columns.filter((column) => existing.has(column));
  }

  private async tableExists(queryRunner: QueryRunner, table: string): Promise<boolean> {
    const rows: Array<{ exists: boolean }> = await queryRunner.query(
      `SELECT to_regclass($1) IS NOT NULL AS exists`,
      [`public.${table}`],
    );
    return Boolean(rows[0]?.exists);
  }
}
