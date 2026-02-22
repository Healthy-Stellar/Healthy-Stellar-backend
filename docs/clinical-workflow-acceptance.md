# Clinical Workflow APIs Acceptance Mapping

This document maps issue `#68` requirements to implemented backend APIs.

## Tasks -> Implementation

### 1) Diagnosis and treatment planning APIs
- `GET /diagnosis/:id/treatment-plans`
- `GET /diagnosis/patient/:patientId/treatment-plans`
- `GET /treatment-plans` with filter DTO (`patientId`, `diagnosisId`, `primaryProviderId`, `status`, date range)
- Diagnosis ID validation enforced during treatment plan create/update.

### 2) Prescription and medication management endpoints
- `GET /pharmacy/prescriptions` (filter/search)
- `PATCH /pharmacy/prescriptions/:id` (safe updates before dispense/cancel)
- `POST /pharmacy/prescriptions/:id/notes`
- `GET /pharmacy/prescriptions/:id/notes`

### 3) Clinical documentation and note APIs
- `POST /clinical-notes`
- `GET /clinical-notes`
- `GET /clinical-notes/:id`
- `PATCH /clinical-notes/:id`
- `POST /clinical-notes/:id/sign`
- `GET /clinical-notes/:id/completeness`

### 4) Medical procedure and surgery management APIs
- Existing procedure management maintained
- Added `POST /procedures/:id/cancel`
- Procedure lifecycle now emits decision-support alerts.

### 5) Clinical decision support and alert APIs
- Existing decision support APIs maintained
- Added automatic evaluations/alerts on treatment plan create/update
- Added automatic alerts on procedure create/update/status/cancel.

### 6) Care plan and treatment tracking endpoints
- `GET /treatment-plans/:id/progress`
- Progress includes objective completion, goals achieved, procedures completed, outcomes recorded.

## Acceptance Criteria -> Evidence

### Clinical workflows are efficiently supported by APIs
- Cross-module routes link diagnosis -> plan -> procedure/prescription -> documentation.

### Medical decision-making is enhanced by system integration
- Decision support auto-evaluates plans and emits contextual alerts.

### Clinical documentation is comprehensive and accessible
- Dedicated clinical notes with note types, completeness checks, and signing.

### Care coordination is improved through API integration
- Progress endpoint provides care-plan tracking data for team workflows.

