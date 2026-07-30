# Feat: Prevent overlapping appointment bookings with advisory locks + buffer time + structured 409

## Summary

Adds end-to-end booking conflict prevention for the appointments module:

- **Service-layer race protection.** `AppointmentService.create()` now serialises concurrent bookings for the same provider and/or physical room via transaction-scoped Postgres advisory locks (`pg_try_advisory_xact_lock`). On contention it fails fast with a 409 (`BOOKING_LOCK_BUSY`) instead of silently double-booking.
- **Buffered overlap detection.** A `SELECT ... FOR UPDATE` over the buffered range `[startTime - buffer, endTime + buffer]` and the composite predicate `(doctor_id = :doctorId OR (room_id IS NOT NULL AND room_id = :roomId))` rejects any overlap within the configured buffer.
- **Configurable cleanup gap.** New env var `APPOINTMENT_BUFFER_MINUTES` (default `15`) controls the cleanup gap between bookings — read fresh on every request, no app restart required.
- **Structured 409 body.** Apex responses carry the conflicting appointment's `id`, `doctorId`, `roomId`, `startTime`, `endTime`, `type`, `status`, plus the requested slot's bounds and the buffer that was applied — and explicitly **omit** `patientId`/`reason`/`notes` to keep PHI out of 409 payloads.
- **Schema changes.** New nullable `appointments.room_id` uuid and a composite `(tenant_id, doctor_id, room_id, start_time, end_time)` index for sub-linear overlap lookups; the over-narrow `UQ_appointments_doctor_time` constraint is dropped because the buffered-overlap query + advisory lock are now the single source of truth.

## Acceptance criteria — how each is satisfied

| Criterion | Where it lives |
| --- | --- |
| Concurrent booking attempts for the same slot resolve to exactly one success | `acquireBookingLocks` (`pg_try_advisory_xact_lock`) + race unit test + e2e race test |
| 409 body includes the conflicting appointment ID + time range | `buildBookingConflictResponse` emits `conflict.appointmentId`, `conflict.startTime`, `conflict.endTime` |
| Buffer time config is respected | `APPOINTMENT_BUFFER_MINUTES` read from `ConfigService` inside the booking transaction |
| Tests cover concurrent booking race conditions | `src/appointments/services/appointment.service.spec.ts` (sequential-mock contract test with explanatory JSDoc) and `test/e2e/appointment-booking-conflict.e2e-spec.ts` (real Postgres) |

## Files changed

- `src/appointments/entities/appointment.entity.ts` — drops `@Unique`, adds nullable `roomId: string | null`.
- `src/appointments/dto/create-appointment.dto.ts` — adds optional `@IsUUID() roomId`.
- `src/appointments/services/appointment.service.ts` — `EntityManager` hoisted to top-of-file imports; `create()` reads `APPOINTMENT_BUFFER_MINUTES`, acquires provider+room advisory locks, runs buffered overlap SELECT FOR UPDATE, emits structured 409.
- `src/migrations/1782900000000-AppointmentBookingConflictPrevention.ts` — **new**: drops `UQ_appointments_doctor_time`, adds `room_id` column, creates `IDX_appointments_room_id` and `IDX_appointments_tenant_doctor_room_start_end` via the shared `createIndexConcurrently` helper; `down()` is guarded so it cannot silently destroy duplicate rows when re-adding the original unique constraint.
- `src/appointments/services/appointment.service.spec.ts` — restored the `'create – room ID generation'` security block + added a `'booking conflict prevention'` describe (buffer respected, same-room, structured 409 with HIPAA assertions, sequential-mock concurrent race contract with explanatory JSDoc, cross-DB safety).
- `test/e2e/appointment-booking-conflict.e2e-spec.ts` — **new**: `TestDatabaseHelper` + `supertest` against the wired module; seeds `DoctorAvailability` rows for every weekday with full-window hours so `checkDoctorAvailability` succeeds regardless of when the suite runs in the week; per-test `dbHelper.clear() + seed` for isolation; gracefully skips when Postgres unreachable.

## Verification (run locally before approving)

1. Apply migration: `npm run migration:run`.
2. Confirm schema: `psql … -c "SELECT indexname FROM pg_indexes WHERE tablename = 'appointments';"` — expect `IDX_appointments_room_id`, `IDX_appointments_tenant_doctor_room_start_end`, and **no** `UQ_appointments_doctor_time`.
3. Unit tests: `npm run test -- --testPathPatterns=src/appointments` — both the telemedicine-security and the new booking-conflict-prevention suites pass.
4. E2E: bring up the test Postgres compose stack and run `npm run test:e2e -- test/e2e/appointment-booking-conflict.e2e-spec.ts`.
5. Live buffer demo (default 15-min buffer):
   - `POST /appointments` for a 30-min slot 14 minutes after an existing 30-min slot → **409** with `{ code: "APPOINTMENT_BOOKING_CONFLICT", conflict: { appointmentId, startTime, endTime, … }, requestedSlot: { bufferMinutes: 15, … } }`.
   - Same call 16 minutes apart → **201**.
6. Race demo: `Promise.all([POST /appointments @10:00, POST /appointments @10:00])` (distinct patient ids) → `[201, 409]` (sorted).
7. HIPAA check on the 409 body (stringify and grep) — must NOT include `patientId`, `reason`, or `notes`.

## Down-migration safety

`npm run migration:revert` then `migration:run` cycle is safe. If any duplicate `(doctor_id, start_time, end_time)` rows exist at down-time, the migration's guarded `DO $$ ... $$` block logs a `RAISE NOTICE` and skips re-adding the unique constraint, so operators can clean up out of band rather than losing data to a hidden ALTER failure.

## Out of scope

- No FK from `appointments.room_id` to a real `rooms` table — the existing project doesn't expose a stable physical-room registry yet; `roomId` is just a uuid and conflict detection keys off equality only.
- Telemedicine sessions continue to compute a per-session `telemedicineRoomId` internally; that virtual id is intentionally **not** consulted for booking conflicts.
