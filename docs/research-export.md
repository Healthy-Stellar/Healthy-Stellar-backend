# Research Export & De-identification

This document is the reference for the **research-export** module
(`src/research-export/`). It is the module that produces de-identified data that
leaves the system, so it is the first thing a compliance reviewer, a researcher
onboarding onto a data-sharing agreement, or an operator running an export will
ask about.

It covers:

- the **two export pipelines**, why they exist, and how their guarantees differ;
- **who can export** (`RESEARCH_EXPORT` permission, research access grants, and
  the admin-approval step);
- the **de-identification rules** — exactly what is removed, generalised or kept,
  including how free-text `clinicalSummary` is scrubbed;
- how **consent** is tracked and what happens on **revocation / expiry**;
- **where datasets go**, retention, and what is **audit-logged**;
- every **`RESEARCH_*` environment variable**;
- how the **HIPAA Safe Harbor / Expert Determination** position is meant to map
  onto this implementation;
- **known limitations**, stated honestly.

> **Scope note.** The code in this module is the source of truth. Where the
> implementation does *not* match what you might expect (missing env var, an
> un-wired route, a best-effort heuristic), this document says so explicitly in
> [Known limitations](#12-known-limitations) rather than describing an aspiration.

---

## TL;DR

| | Pipeline A — S3 dispatch | Pipeline B — NDJSON stream |
|---|---|---|
| Code | `ResearchExportService` (`exportAnonymizedDataset`) | `ResearchAnonymizerService` + `ResearchExportController` |
| Entry point | **Service method only** — not exposed by any HTTP route | `POST /research-export/anonymized` |
| Purpose | Persist a de-identified dataset to object storage for a named recipient | Stream a de-identified dataset to a caller on the fly |
| Pseudonym | `sha256`, keyed with `ANONYMIZATION_SALT` (+ per-process salt) | `HMAC-SHA256`, keyed with `RESEARCH_EXPORT_HASH_SALT` |
| Reversible? | No (keyed hash; re-identification is **not** implemented) | No (one-way HMAC by design) |
| k-anonymity | `RESEARCH_K_ANONYMITY` (default **3**, hard floor **5**) | **Fixed at 5** (`RESEARCH_EXPORT_MIN_K`) |
| k counts | **distinct patients** per group | **rows** per group |
| Approval | `approvedBy` required for a non-`dryRun` dispatch | none (no `dryRun`/approval concept) |
| Output | JSON object written to S3 | `application/x-ndjson`, one JSON row per line |
| Fields | `pseudoId, ageBracket, sex, region, yearOfRecord, recordType, clinicalSummary` | `pseudoId, ageRange, region, recordType, yearOfRecord, clinicalSummary` |

---

## 1. The two pipelines, and why they differ

Both pipelines read the **same** `MedicalRecord` + `Patient` data, apply the
**same** free-text scrubber (`stripPii`), and enforce k-anonymity. They differ in
**delivery**, **key management**, and **k**, because they serve different
consumers:

### Pipeline A — S3 dispatch export (`ResearchExportService`)

- Built for a **batch dataset handed to a named researcher / data-sharing
  partner**. `exportAnonymizedDataset(researcherId, filters, { approvedBy })`
  selects records, de-identifies them, applies k-anonymity, and — unless
  `dryRun` is set — writes a single JSON document to object storage.
- Requires an **admin approval** (`approvedBy`) before a real dispatch: a
  researcher cannot self-authorise the write (see [§3](#3-who-can-export)).
- Uses `sha256` keyed with `ANONYMIZATION_SALT` for the pseudo-id, mixed with a
  per-process random component so pseudo-ids are not stable across restarts.
- `k` comes from `RESEARCH_K_ANONYMITY`, defaulting to **3** and floored at
  **5** (`RESEARCH_K_MIN_FLOOR`), and suppression counts **distinct patients**.

### Pipeline B — NDJSON stream (`ResearchAnonymizerService`)

- Built for an **interactive, transient** request: a caller posts a filter and
  receives de-identified rows streamed back as NDJSON. Nothing is persisted.
- Uses a **non-reversible** `HMAC-SHA256` keyed with `RESEARCH_EXPORT_HASH_SALT`
  — deterministic per patient (so records for the same patient group together)
  but not reversible to the source identifier, because this stream is not meant
  to support re-identification at all.
- `k` is **fixed at 5** (`RESEARCH_EXPORT_MIN_K`, per issue #761) and cannot be
  lowered by configuration. Suppression counts **rows**.

**Why the guarantees differ.** Pipeline A is a persisted artefact that a data
agreement can govern, so it keeps an approval gate and a configurable — but
floor-protected — `k`. Pipeline B is a live stream where the caller can retry,
so it takes the stricter, non-configurable `k = 5` and a one-way hash, and it
**fails the request** (`422`) rather than emitting a partial or under-suppressed
result.

> ⚠️ **Status.** Pipeline A currently has **no HTTP route** wired to it and is
> only exercised by unit tests, and its call site does not supply the
> quasi-identifier allow-list the de-identify step requires. Treat Pipeline A as
> **not yet reachable from the API** — see
> [Known limitations](#12-known-limitations). Pipeline B is the live, supported
> endpoint.

---

## 2. Module layout

```
src/research-export/
├── research-export.controller.ts        # POST /research-export/anonymized (NDJSON stream)
├── research-export.service.ts           # Pipeline A: S3 dispatch + stripPii + k-anonymity
├── research-anonymizer.service.ts       # Pipeline B: HMAC hashing + generalisation + k=5
├── services/consent-revocation.service.ts # Consent tracking, hourly expiry sweep, flagging
├── entities/export-consent-mapping.entity.ts
└── dto/research-export.dto.ts
```

---

## 3. Who can export

Both pipelines require the caller to clear **three** independent gates.

### 3.1 Authentication + permission

The controller is declared as:

```ts
@ApiTags('Research Export')
@Controller('research-export')
@UseGuards(JwtAuthGuard, MedicalRbacGuard)
```

so a request must (a) carry a valid bearer JWT and (b) pass the medical RBAC
guard. The stream endpoint additionally requires:

```ts
@RequirePermissions(MedicalPermission.RESEARCH_EXPORT)
```

`ResearchExportController.streamAnonymizedExport` is the only route in the
module, and it is the only place `RESEARCH_EXPORT` is enforced at the HTTP layer.

The `RESEARCH_EXPORT` permission is currently granted to these built-in
medical roles:

| Role | Source |
|---|---|
| `ADMIN` (System Administrator) | `medical-permissions.service.ts`, `role-template.service.ts` |
| `DOCTOR` (Attending Physician) | `medical-permissions.service.ts`, `role-template.service.ts` |

### 3.2 Research access grant

Permission alone is not enough — the caller must also hold an **active
`AccessGrant`**. `ResearchExportService.assertValidGrant(researcherId)` looks up
the most recent grant where `granteeId = <caller>` and `status = ACTIVE`, and
throws `403 Forbidden` if:

- no active grant exists (`No active research access grant found`), or
- the grant has expired (`Research access grant has expired`).

The grant's `organizationId` is used to scope record selection, so a researcher
can only ever export records belonging to their own organisation.

### 3.3 Grant-scoped record selection

`fetchRecords` only ever returns records that are:

- `status = 'active'`, **and**
- `organizationId = <grant.organizationId>`,

with optional `recordType`, `fromYear` and `toYear` filters.

### 3.4 Admin approval (Pipeline A only)

`exportAnonymizedDataset` refuses a **non-`dryRun`** dispatch unless an
`approvedBy` value is supplied, throwing `403 Forbidden`:

```
Research export requires admin approval before dispatch
```

There is no controller route that supplies `approvedBy` today, so this gate is
enforced at the service boundary only.

**Summary of the flow**

```
JWT (JwtAuthGuard)
  └─ RESEARCH_EXPORT permission (MedicalRbacGuard / @RequirePermissions)
       └─ active, unexpired AccessGrant (assertValidGrant)
            └─ records scoped to grant.organizationId
                 └─ [Pipeline A only] admin approval (approvedBy)
```

Any failure above yields **`403`**; the k-anonymity failure in Pipeline B yields
**`422`** (see [§5](#5-k-anonymity)).

---

## 4. De-identification rules

Each record is reduced to a small set of generalised fields. Direct identifiers
(patient id, name, MRN, address, exact dates, contact details, free-text PHI) are
removed or generalised as follows.

### 4.1 Field-level rules

| Field | Source | Treatment | Pipeline A output | Pipeline B output |
|---|---|---|---|---|
| Patient identifier | `patientId` | Keyed one-way hash | `pseudoId` (hex, 16 chars) | `pseudoId` (hex, 64 chars) |
| Age | `patient.dateOfBirth` | 5-year bands; `90+` open-ended | `ageBracket` (`"35-39"`, `"90+"`, `"unknown"`) | `ageRange` (`"35-39"`, `"90+"`, `"unknown"`) |
| Sex | `patient.sex` | Kept verbatim (see limitations) | `sex` (`"M"`/`"F"`/`"unknown"`) | *not exported* |
| Region | `patient.address` | Street/city/ZIP removed; state/region/country kept | `region` | `region` |
| Date | `record.recordDate` | Reduced to year | `yearOfRecord` | `yearOfRecord` |
| Record type | `record.recordType` | Kept | `recordType` | `recordType` |
| Free text | `record.description` ?? `record.title` | `stripPii` (regex + NER) | `clinicalSummary` | `clinicalSummary` |

Notes:

- **Age generalisation** uses fixed 5-year bands computed from
  `currentYear - birthYear`; anyone 90 or older collapses into `90+`. Both
  pipelines use the same banding helper (`toAgeBracket` / `toAgeRange`).
- **Region generalisation** strips ZIP/ZIP+4, splits the address on commas /
  newlines, and keeps the **last** non-empty token. For structured addresses it
  prefers an explicit `state`, then `region`, then `province`, then `country`.
  Street and city are never exported.
- **Record type** is kept deliberately: it is a quasi-identifier, not a direct
  identifier, and it is needed for the export to be analytically useful.
- In Pipeline A, `ageBracket`, `sex`, `region` and `yearOfRecord` are each gated
  behind an internal *quasi-identifier allow-list* parameter; a field that is not
  on the list is emitted as the literal string `"suppressed"`. This allow-list is
  **not** wired to any environment variable today (see
  [Known limitations](#12-known-limitations)).

### 4.2 Free-text scrubbing — `stripPii`

`stripPii` is exported from `research-export.service.ts` and shared by **both**
pipelines. It runs two passes.

**Pass 1 — structural regex** (`STRUCTURAL_PII_PATTERNS`), a Best-Effort pass for
identifiers with a reliable lexical form. Each match becomes `[REDACTED]`:

| # | Identifier | Pattern (informal) |
|---|---|---|
| 1 | Social Security Number | `\d{3}-\d{2}-\d{4}` |
| 2 | Phone / fax | `(800) 123-4567`, `555-867-5309`, … |
| 3 | Email | `name@example.com` |
| 4 | Web URL | `http(s)://…` |
| 5 | IP address | `192.168.1.42` |
| 6 | Street address | `42 Elm Street`, `1 Hospital Rd`, … |
| 7 | Full date — `Month DD, YYYY` | `January 15, 1980` |
| 8 | Full date — `MM/DD/YYYY` / `DD/MM/YYYY` | `03/22/1975` |
| 9 | Full date — `YYYY-MM-DD` | `2023-11-04` |
| 10 | ZIP / ZIP+4 | `90210`, `10001-1234` |
| 11 | Passport / licence numbers | `[A-Z]{1,2}\d{6,9}` |
| 12 | Medical record number | `MRN: 00847321` |
| 13 | Account / policy / member / device / serial / certificate / licence IDs | `Account #: ACC-20948-X`, … |

**Pass 2 — lightweight NER** (`nerRedact`), a dependency-free heuristic with
three sub-passes, because names have no reliable lexical form:

1. **Titled names** — `Dr. Jane Smith`, `Mr. John Doe`, `Nurse …`, `MD`, `DO`,
   `PA`, `NP`, … → `[REDACTED]`.
2. **Patient-subject names** — `Patient John Doe`, `pt. Jane Smith` … keeps the
   label word and drops the name.
3. **Mid-sentence capitalised bi/tri-grams** — a capitalised word sequence
   preceded by a lower-case letter, comma, semicolon, colon or period plus
   whitespace. Catches `John Doe` in isolation inside a note.

`stripPii` is intentionally conservative: it may over-redact capitalised clinical
terms, which is the correct trade-off when the cost of a false negative is worse
than a false positive. Its limits are documented in
[§12](#12-known-limitations).

---

## 5. k-anonymity

Both pipelines group records by their generalised **quasi-identifier
combination** and drop groups that are too small, so no combination of
quasi-identifiers is disclosed for fewer than `k` subjects.

| | Pipeline A | Pipeline B |
|---|---|---|
| Threshold | `RESEARCH_K_ANONYMITY` (default **3**, floored at **5**) | **5** (`RESEARCH_EXPORT_MIN_K`), not configurable |
| Group key | `ageBracket \| region \| recordType \| yearOfRecord` | `ageRange \| region \| recordType \| yearOfRecord` |
| Counts | **distinct patients** | **rows** |
| Under-size groups | silently suppressed | silently suppressed |
| No surviving group | returns an empty result | throws `422 Unprocessable Entity` |

Pipeline B refuses to return anything rather than emit unsafe partial data:

```
422 Unprocessable Entity
k-anonymity constraint (k>=5) could not be satisfied for this filter —
no quasi-identifier group reaches the minimum group size. Broaden the filter and retry.
```

**Which k applies to you:** the NDJSON endpoint (`POST /research-export/anonymized`)
always uses `k = 5`. `RESEARCH_K_ANONYMITY` only affects Pipeline A.

---

## 6. Consent tracking and revocation

### 6.1 `ExportConsentMapping`

Every dispatch export is meant to be recorded in the `export_consent_mappings`
table so that consent can be traced from a **patient** to the **export batches
that contain their data**:

| Column | Meaning |
|---|---|
| `id` | Row id (uuid) |
| `exportId` | The export batch this row belongs to |
| `patientId` | The patient whose data is in the batch |
| `consentId` | Consent record this mapping relates to (nullable) |
| `tenantId` | Owning tenant |
| `researchRecipientId` | The researcher / recipient the batch was produced for |
| `status` | `active` → `flagged` → `purged` (`ExportBatchStatus`) |
| `flaggedAt`, `flagReason` | When and why the row was flagged |
| `createdAt`, `updatedAt` | Timestamps |

`ConsentRevocationService.trackExportBatch(exportId, patientIds, tenantId,
researchRecipientId)` writes one row per patient.

### 6.2 What revocation actually does

`ConsentRevocationService` reacts to revocation in two ways:

**On explicit revocation** — `revokePatientConsent(patientId, revokedBy, reason)`
flags every **active** mapping for that patient.

**On expiry** — a scheduled sweep (`@Cron(CronExpression.EVERY_HOUR)`,
`checkExpiredConsents`) finds `AccessGrant`s that are `ACTIVE` but past
`expiresAt`, flags the batches for **the grant's patient**, and marks the grant
`REVOKED`.

Both paths funnel into `flagExportBatchesForPatient`, which:

1. sets each affected mapping to `FLAGGED`, records `flaggedAt` and `flagReason`
   (`patient_request` or `consent_expired`);
2. emits a `research.export.revoked` event once **per distinct export batch**;
3. writes an audit entry (`CONSENT_REVOCATION_FLAGGED`) per batch;
4. logs a warning with the count of flagged mappings.

**Important:** flagging is a *tracking* action. It does **not** delete or
re-encrypt datasets that have already been exported to S3. `getFlaggedBatches`
exposes flagged rows for a tenant, but there is no route or scheduled job in this
repo that consumes the `research.export.revoked` event and purges the stored
object — see [Known limitations](#12-known-limitations).

---

## 7. Storage, location and retention

### 7.1 Where datasets go

- **Pipeline A** writes one JSON document per export to the bucket named by
  `RESEARCH_EXPORT_BUCKET` (default: `research-exports`), in the region named by
  `AWS_REGION` (default: `us-east-1`), using the S3 client's standard credential
  chain.
  - Object key: `research-exports/{researcherId}/{exportId}.json`
  - Content type: `application/json`
  - Server-side encryption: **`aws:kms`** (`ServerSideEncryption: 'aws:kms'`)
  - Metadata: `researcherId`, `exportId`
  - The returned `storageRef` is the object key.
- **Pipeline B** persists **nothing** — rows are streamed to the caller with
  `Content-Type: application/x-ndjson` and `Cache-Control: no-store`.

### 7.2 Retention

There is **no retention policy for exported research datasets** in the
`data-retention` module. Nothing in this repo deletes objects from
`RESEARCH_EXPORT_BUCKET`. Erasure of exported datasets is therefore an operator
responsibility (S3 lifecycle rules, contractual terms with the recipient), not
something the application enforces. See
[Known limitations](#12-known-limitations).

---

## 8. Audit events

Every export request is recorded, including previews and requests that later
fail.

| Trigger | Audit action | `resourceType` | Detail |
|---|---|---|---|
| Pipeline A `dryRun` | `DATA_EXPORT` | `AnonymizedResearchExport` | `exportId`, `recordCount`, `filters`, `dryRun: true` |
| Pipeline A real dispatch | `DATA_EXPORT` | `AnonymizedResearchExport` | `exportId`, `recordCount`, `filters`, `approvedBy` |
| Pipeline B stream request | `DATA_EXPORT` | `AnonymizedResearchExportStream` | `filters`, `endpoint`; logged **before** any data is read, so a `422` k-anonymity failure is still captured |
| Consent revoked / expired | `CONSENT_REVOCATION_FLAGGED` | `ExportConsentMapping` | `entityId = exportId`, `userId = actor`, `changes = { patientId, reason, status }` |

Export audit entries are written with `AuditService.logDataExport`, which records
`action = DATA_EXPORT`, **severity `MEDIUM`**, the acting user, IP address and
user agent, and participates in the standard audit hash chain. The stream
endpoint records the caller's IP (`req.ip`) and `User-Agent` before returning
any bytes.

---

## 9. Environment variables

All research-export configuration:

| Variable | Default | Secret | Used by | Purpose |
|---|---|---|---|---|
| `RESEARCH_EXPORT_BUCKET` | `research-exports` | – | Pipeline A | S3 bucket for persisted datasets |
| `RESEARCH_EXPORT_HASH_SALT` | *none — **required*** | ✅ | Pipeline B | HMAC key for the NDJSON stream's `pseudoId`. `hashIdentifier` throws if unset/empty |
| `RESEARCH_K_ANONYMITY` | `3`, floored to `5` | – | Pipeline A | Minimum group size (distinct patients). Values below 5 are raised to 5; non-numeric values fall back to 3 |
| `ANONYMIZATION_SALT` | `default-salt` | ✅ | Pipeline A | Base key for `pseudonymize` (mixed with a per-process salt). **Not** `RESEARCH_`-prefixed, but it is the keying material for Pipeline A |
| `AWS_REGION` | `us-east-1` | – | Pipeline A | Region for the S3 client |

Standard AWS credentials (`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` or an
instance/task role) are needed for Pipeline A writes, and KMS permissions are
required because objects are written with `aws:kms` encryption.

> There is **no** `RESEARCH_PSEUDONYM_KEY` and **no** `RESEARCH_QUASI_IDENTIFIERS`
> variable in this codebase. Pipeline A keys its pseudo-ids with
> `ANONYMIZATION_SALT`, and the per-field allow-list it consults is a code-level
> parameter, not configuration. See
> [Known limitations](#12-known-limitations).

See `.env.example` → *RESEARCH EXPORT* for the canonical placeholders.

---

## 10. Request / response examples

### 10.1 `POST /research-export/anonymized` (Pipeline B — NDJSON stream)

Requires a bearer JWT with the `RESEARCH_EXPORT` permission **and** an active
research grant. No `dryRun`, no approval.

**Request**

```http
POST /research-export/anonymized
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "recordType": "lab_result",
  "fromYear": "2022",
  "toYear": "2024"
}
```

**Response `200 OK`** — `Content-Type: application/x-ndjson`, one row per line:

```
{"pseudoId":"9f2c1a7b…","ageRange":"40-44","region":"CA","recordType":"lab_result","yearOfRecord":2023,"clinicalSummary":"Patient [REDACTED] reports…"}
{"pseudoId":"9f2c1a7b…","ageRange":"40-44","region":"CA","recordType":"lab_result","yearOfRecord":2024,"clinicalSummary":"Follow-up panel [REDACTED]"}
```

**Response `403 Forbidden`** — missing permission or no active grant:

```json
{ "statusCode": 403, "message": "No active research access grant found", "error": "Forbidden" }
```

**Response `422 Unprocessable Entity`** — no quasi-identifier group reaches k=5:

```json
{
  "statusCode": 422,
  "message": "k-anonymity constraint (k>=5) could not be satisfied for this filter — no quasi-identifier group reaches the minimum group size. Broaden the filter and retry.",
  "error": "Unprocessable Entity"
}
```

### 10.2 Pipeline A — S3 dispatch export (service call)

Not currently routed over HTTP; invoked as a service method. A non-`dryRun`
dispatch must carry `approvedBy`. `dryRun: true` returns at most 10 sample rows
and writes nothing to S3.

**Call**

```ts
await researchExportService.exportAnonymizedDataset(
  'researcher-1',
  { recordType: 'diagnosis', fromYear: '2020', toYear: '2024', dryRun: false },
  { approvedBy: 'admin-9' },
);
```

**Response** (`AnonymizedExport`)

```json
{
  "exportId": "b6c1f0e2-7a4d-4c9e-9b1a-2f0e5d8c7a11",
  "researcherId": "researcher-1",
  "recordCount": 128,
  "exportedAt": "2026-11-24T09:15:04.512Z",
  "storageRef": "research-exports/researcher-1/b6c1f0e2-7a4d-4c9e-9b1a-2f0e5d8c7a11.json",
  "records": [
    {
      "pseudoId": "3ab90f12cd45e678",
      "ageBracket": "40-44",
      "sex": "F",
      "region": "MA",
      "yearOfRecord": 2023,
      "recordType": "diagnosis",
      "clinicalSummary": "Type 2 diabetes mellitus, on metformin [REDACTED]"
    }
  ]
}
```

With `dryRun: true`, `storageRef` is `null` and `records` contains at most 10
sample rows.

---

## 11. HIPAA Safe Harbor / Expert Determination

**Position:** this module implements a **Safe-Harbor-style** de-identification
pipeline. It is **not** an Expert Determination, and no statistical
re-identification study has been performed.

| HIPAA Safe Harbor identifier | How this module handles it |
|---|---|
| Names | `nerRedact` (titled, patient-subject, capitalised bi/tri-gram) |
| Geographic subdivisions < state | Generalised to region only — street, city and ZIP/ZIP+4 removed; state/country kept |
| Dates (except year) & ages > 89 | Dates reduced to year (`yearOfRecord`); ages banded to 5 years and `90+` |
| Phone / fax | Structural regex |
| Email | Structural regex |
| SSN | Structural regex |
| Medical record numbers | Structural regex (`MRN`) |
| Health plan / beneficiary numbers | Structural regex (account/policy patterns) |
| Account numbers | Structural regex |
| Certificate / licence numbers | Structural regex |
| Vehicle / device identifiers & serial numbers | Structural regex (serial/device patterns) |
| Web URLs | Structural regex |
| IP addresses | Structural regex |
| Biometric identifiers | Best-effort via the NER capitalised-sequence pass (no reliable lexical form) |
| Full-face photographs / images | Not applicable — text pipeline only |
| Any other unique identifying number/characteristic | Keyed one-way pseudo-id replaces the raw patient id |

**Why this is Safe-Harbor-*style* and not Safe-Harbor-*certified*:**

- Safe Harbor requires removal of **all** listed identifiers. Free-text names and
  contextual identifiers are caught only by a heuristic, so residual identifiers
  are possible (see [§12](#12-known-limitations)).
- The module relies on **pseudo-ids plus k-anonymity** rather than pure removal;
  pseudo-ids preserve longitudinal linkage, which Safe Harbor does not address
  but an Expert Determination would quantify.
- No Expert Determination report, re-identification-risk analysis, or
  `k`-vs-utility justification exists in this repo.

**Practical guidance:** treat every output of this module as
**de-identified-but-linkable**, usable under an appropriate data-sharing
agreement, and do **not** represent it to a downstream recipient as
Expert-Determined or unconditionally Safe Harbor-compliant without a separate
review.

---

## 12. Known limitations

These are real and deliberate; document them when reviewing a data-sharing
agreement.

1. **Free-text scrubbing is best-effort.** `stripPii` is a regex pass plus a
   dependency-free heuristic NER pass — there is no ML/NER model. It can miss
   names in unusual forms, non-Latin scripts, names written as initials or
   numbers, sentence-initial names (the mid-sentence lookbehind requires a
   preceding lower-case letter/punctuation), and identifiers with no stable
   lexical shape. It may also over-redact capitalised clinical terms.
2. **Pseudo-ids allow linkage.** `pseudoId` is deterministic for a given patient
   within its keying context. Records belonging to the same patient can be
   linked, and repeated exports can be linked to each other. It is a
   pseudonym, not anonymisation of the longitudinal dimension.
3. **Pseudo-id keys are weak by design where defaults exist.** Pipeline A falls
   back to `default-salt` if `ANONYMIZATION_SALT` is unset, and Pipeline B
   requires `RESEARCH_EXPORT_HASH_SALT`. A leaked or guessed key plus a small
   identifier space could permit dictionary re-identification.
4. **Pipeline A is not reachable from the API.** `exportAnonymizedDataset` is not
   wired to any route; only Pipeline B (`POST /research-export/anonymized`) is
   live. Pipeline A's de-identify step also requires a quasi-identifier
   allow-list parameter that the current call site does not supply, and there is
   no `RESEARCH_QUASI_IDENTIFIERS` environment variable — so Pipeline A will not
   produce output as shipped.
5. **Pipeline A guard semantics are unverified.** `ageBracket`/`sex`/`region`/
   `yearOfRecord` are gated behind the internal allow-list above; until that is
   plumbed to configuration and a route exists, treat Pipeline A's field output
   as unspecified.
6. **The two pipelines count `k` differently.** Pipeline A counts **distinct
   patients** per group; Pipeline B counts **rows**. In Pipeline B a single
   patient contributing many records can satisfy the row count, so the effective
   per-patient protection is weaker than the number suggests.
7. **`region` filter is accepted but unused.** `ResearchExportFiltersDto` /
   `AnonymizedExportFilterDto` declare `region`, but `fetchRecords` never
   applies it, so it currently has no effect on record selection.
8. **Consent flagging does not purge data.** Revocation/expiry flags mapping
   rows and emits `research.export.revoked`, but nothing in this repo consumes
   that event to delete or re-encrypt already-exported S3 objects, and
   `getFlaggedBatches` / `revokePatientConsent` / `trackExportBatch` are not
   exposed by any controller. Eradication of exported data is manual.
9. **No retention enforcement.** The `data-retention` module does not cover
   research exports; nothing deletes objects from `RESEARCH_EXPORT_BUCKET`.
10. **`sex` is exported verbatim** by Pipeline A (not generalised), which is an
    additional quasi-identifier in combination with age band + region.
11. **No re-identification tooling.** Despite a test referencing
    `reIdentify(...)`, no re-identification path exists; blocklist-style
    verification that a dataset cannot be reversed is not implemented.

---

## 13. See also

- `.env.example` → *RESEARCH EXPORT*
- [`docs/auth.md`](auth.md) — guard/JWT conventions used by the controller
- [`docs/runbooks/`](runbooks/README.md) — operational runbooks
- `src/research-export/` — the implementation
