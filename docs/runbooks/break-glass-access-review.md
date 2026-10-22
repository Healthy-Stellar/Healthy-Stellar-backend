# Break-Glass Access Review

## Purpose

Break-glass access lets a clinician open a patient's records without a prior
access grant when there is an immediate clinical need. Every break-glass grant is
time-boxed and must be reviewed by a supervisor. This runbook describes how
operators and compliance reviewers inspect, review, and revoke break-glass
access.

## Trigger

- A `BREAK_GLASS_GRANTED` audit event is raised and the patient notification
  email is sent (the grant itself automatically flags `requiresReview: true`).
- The scheduled sweep reports an SLA breach (`BREAK_GLASS_SLA_BREACH` audit
  event, severity `critical`), or the `sla-breaches` endpoint returns entries.
- A patient, clinician, or compliance request asks for the access history of a
  specific patient or grantee.
- An active session is believed to be misused and must be revoked.

## Impact

- **Active access:** the grantee can read the patient's records until
  `expiresAt`. Access auto-expires after `BREAK_GLASS_TTL_MS` (default 4 hours)
  via the sweep, which marks expired sessions `EXPIRED`.
- **Expired but unreviewed:** the access no longer grants read access, but it is
  still a compliance obligation — it must be reviewed. Expired sessions are
  reviewable (`reviewBreakGlassAccess` accepts `ACTIVE` or `EXPIRED`).
- **Overdue review:** once `BREAK_GLASS_REVIEW_SLA_MS` (default 24 hours) has
  passed without review, the sweep records a `BREAK_GLASS_SLA_BREACH` audit
  event. This is a compliance finding and should be escalated.
- **Incorrect handling:** revoking or denying incorrectly can block legitimate
  care; approving without reading the justification defeats the control.

## Prerequisites

- An operator/admin JWT with the `admin` role (review, revoke, sweep, and
  listing endpoints all require `ADMIN`). Granting requires `PHYSICIAN`,
  `NURSE`, or `ADMIN`.
- API base URL and the ability to call the endpoints with the bearer token.
- The break-glass sweep runs automatically every 15 minutes; a manual sweep is
  also available.

## Steps

All paths below are relative to the API base URL. The API supports URI
versioning, so `POST /v1/access/break-glass/grant` is equivalent to
`POST /access/break-glass/grant`.

1. **List unreviewed break-glass sessions** (returns active, unreviewed sessions
   that are past the review SLA):

   ```bash
   curl -H "Authorization: Bearer $ADMIN_TOKEN" \
     "$API_URL/access/break-glass/unreviewed"
   ```

2. **List SLA breaches explicitly** (active, unreviewed, older than the review
   SLA):

   ```bash
   curl -H "Authorization: Bearer $ADMIN_TOKEN" \
     "$API_URL/access/break-glass/sla-breaches"
   ```

3. **Inspect a specific patient's or grantee's history** to gather context for
   the review:

   ```bash
   curl -H "Authorization: Bearer $ADMIN_TOKEN" \
     "$API_URL/access/break-glass/patient/$PATIENT_ID"

   curl -H "Authorization: Bearer $ADMIN_TOKEN" \
     "$API_URL/access/break-glass/grantee/$GRANTEE_ID"
   ```

   Each record includes `justification`, `clinicalContext`, `status`,
   `expiresAt`, and, once reviewed, `reviewedBy`, `reviewedAt`,
   `reviewNotes`, and `reviewOutcome`.

4. **Review the session** as a supervisor. `outcome` is `approved` or `denied`;
   `reviewNotes` is required:

   ```bash
   curl -X PATCH -H "Authorization: Bearer $ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"outcome":"approved","reviewNotes":"Justification validated against ED triage notes."}' \
     "$API_URL/access/break-glass/$ACCESS_ID/review"
   ```

   Reviewing sets the status to `REVIEWED` and records an
   `BREAK_GLASS_REVIEWED_APPROVED` or `BREAK_GLASS_REVIEWED_DENIED` audit event.

5. **Revoke immediately** if the session is under suspicion (does not require the
   session to be unreviewed). `reason` is required:

   ```bash
   curl -X PATCH -H "Authorization: Bearer $ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"reason":"Grantee account compromised — revoking pending investigation."}' \
     "$API_URL/access/break-glass/$ACCESS_ID/revoke"
   ```

   Revoking sets the status to `REVOKED` and records a `BREAK_GLASS_REVOKED`
   audit event.

6. **Force a sweep** (optional) to expire overdue sessions and emit SLA-breach
   events immediately instead of waiting for the 15-minute interval:

   ```bash
   curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
     "$API_URL/access/break-glass/sweep"
   ```

   The response reports `expired` and `slaBreaches` counts.

## Verification

- `GET /access/break-glass/unreviewed` and `sla-breaches` no longer return the
  session you handled.
- The session record shows `status: REVIEWED` (with `reviewedBy`/`reviewedAt`)
  or `status: REVOKED`.
- The corresponding audit event (`BREAK_GLASS_REVIEWED_*` or
  `BREAK_GLASS_REVOKED`) appears in the audit log.
- Re-running the sweep reports `expired: 0` for the sessions you expect to be
  handled.

## Rollback / Recovery

- A review is not a reversible state transition. If a review was performed in
  error, do **not** attempt to edit the database directly. Instead:
  - If the grantee should no longer have access, use `revoke` — this is the
    supported way to terminate access regardless of review state.
  - Record the correction in the audit trail by revoking with a clear `reason`
    that references the original review, and notify compliance.
- If a grant must be undone while still active, `revoke` immediately terminates
  access (status `REVOKED`).
- If the sweep has not yet marked a session expired, the expiry check in
  `hasActiveBreakGlassAccess` still treats it as expired once `expiresAt` has
  passed, so access is not extended.

## Related Configuration

| Variable | Default | Meaning |
|---|---|---|
| `BREAK_GLASS_TTL_MS` | `14400000` (4 hours) | Lifetime of a break-glass session. |
| `BREAK_GLASS_REVIEW_SLA_MS` | `86400000` (24 hours) | Time within which a supervisor must review the grant. |

The sweep interval (15 minutes) is fixed in code (`SWEEP_INTERVAL_MS`).

## Related Code

- `src/access-control/services/break-glass.service.ts`
- `src/access-control/controllers/break-glass.controller.ts`
- `src/access-control/entities/break-glass-access.entity.ts`
  (table `break_glass_accesses`, statuses `ACTIVE`, `EXPIRED`, `REVIEWED`,
  `REVOKED`)
- Audit actions: `BREAK_GLASS_GRANTED`, `BREAK_GLASS_REVIEWED_APPROVED` /
  `BREAK_GLASS_REVIEWED_DENIED`, `BREAK_GLASS_REVOKED`, `BREAK_GLASS_SLA_BREACH`.
