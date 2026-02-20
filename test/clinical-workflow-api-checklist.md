# Clinical Workflow API Verification Checklist

Use this checklist to validate issue #68 behavior end-to-end.

## Setup

- [ ] Start database services (PostgreSQL) and ensure `.env` values are correct.
- [ ] Run `npm run build`.
- [ ] Run `npm run start:dev`.

## Diagnosis -> Treatment Plan Integration

- [ ] Create diagnosis via `POST /diagnosis`.
- [ ] Create treatment plan with `diagnosisIds`.
- [ ] Verify diagnosis validation blocks invalid IDs.
- [ ] Verify `GET /diagnosis/:id/treatment-plans` returns linked plans.
- [ ] Verify `GET /diagnosis/patient/:patientId/treatment-plans` returns diagnoses with plans.

## Prescription and Medication APIs

- [ ] Create prescription via `POST /pharmacy/prescriptions`.
- [ ] Search via `GET /pharmacy/prescriptions?status=pending`.
- [ ] Update via `PATCH /pharmacy/prescriptions/:id`.
- [ ] Add note via `POST /pharmacy/prescriptions/:id/notes`.
- [ ] Read notes via `GET /pharmacy/prescriptions/:id/notes`.

## Clinical Documentation APIs

- [ ] Create clinical note via `POST /clinical-notes`.
- [ ] Query notes via `GET /clinical-notes?patientId=<id>`.
- [ ] Verify completeness via `GET /clinical-notes/:id/completeness`.
- [ ] Sign complete note via `POST /clinical-notes/:id/sign`.
- [ ] Confirm signed note cannot be updated.

## Procedures, Alerts, and Care Tracking

- [ ] Schedule procedure via `POST /procedures`.
- [ ] Update/cancel procedure and verify status updates.
- [ ] Confirm alerts are created in decision support module after plan/procedure lifecycle changes.
- [ ] Verify `GET /treatment-plans/:id/progress` returns progress metrics.

## Acceptance Criteria Validation

- [ ] Clinical workflows are supported across diagnosis, plan, medication, and notes.
- [ ] Decision-support alerts are generated from integrated clinical events.
- [ ] Clinical documentation is structured and accessible.
- [ ] Care coordination signals (progress/outcomes/procedure states) are available via API.

