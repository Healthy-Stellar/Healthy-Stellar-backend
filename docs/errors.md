# Error Handling & Error-Code Catalog

This document is the authoritative reference for how the Healthy-Stellar backend
reports errors. It covers:

- the [response envelope](#response-envelope) every error uses,
- the [error-code catalog](#error-code-catalog) — every `AppErrorCode` value with its HTTP status, meaning, and retryability,
- [which exception filter handles what, and in what order](#exception-filters-what-handles-what),
- [what gets sanitized](#sanitization) before it reaches a client,
- [how `traceId` relates to logs and tracing](#traceid-logs-and-tracing) for support requests.

Sources of truth in code:

| Concern                         | File                                                                                                                |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Error-code taxonomy             | [`src/common/exceptions/error-codes.ts`](../src/common/exceptions/error-codes.ts)                                   |
| Response envelope (Swagger DTO) | [`src/common/dto/api-error-response.dto.ts`](../src/common/dto/api-error-response.dto.ts)                           |
| Effective global filter         | [`src/common/filters/global-exception.filter.ts`](../src/common/filters/global-exception.filter.ts)                 |
| Global filter registration      | [`src/main.ts`](../src/main.ts) (`useGlobalFilters`) and [`src/app.module.ts`](../src/app.module.ts) (`APP_FILTER`) |

---

## Response envelope

Every non-FHIR error response is produced by `GlobalExceptionFilter` and matches
[`ApiErrorResponse`](../src/common/dto/api-error-response.dto.ts):

| Field        | Type                    | Description                                                                                                                       |
| ------------ | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `statusCode` | number                  | HTTP status code (mirrors the response status).                                                                                   |
| `error`      | string                  | HTTP reason phrase, e.g. `"Bad Request"`, `"Conflict"`.                                                                           |
| `message`    | string                  | Human-readable message. Safe to show to users for 4xx; generic for unexpected 5xx.                                                |
| `code`       | string                  | **Machine-readable** [`AppErrorCode`](#error-code-catalog). Branch on this, not on `message`.                                     |
| `traceId`    | string (uuid)           | Per-error correlation id. See [`traceId`, logs, and tracing](#traceid-logs-and-tracing).                                          |
| `timestamp`  | string (ISO 8601)       | When the error was produced, e.g. `2024-05-30T10:30:45.123Z`.                                                                     |
| `path`       | string                  | Request path where the error occurred.                                                                                            |
| `details`    | object \| array \| null | Optional. Structured context (e.g. validation field errors, `expectedVersion`/`currentVersion`, `txHash`). Shape varies by error. |

Example (`409` optimistic-locking conflict):

```json
{
  "statusCode": 409,
  "error": "Conflict",
  "message": "Resource version conflict",
  "code": "RECORD_VERSION_CONFLICT",
  "traceId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2024-05-30T10:30:45.123Z",
  "path": "/api/v1/medical-records/123",
  "details": {
    "expectedVersion": "1",
    "currentVersion": "2",
    "suggestion": "Refresh the resource and retry with the new version in the If-Match header"
  }
}
```

### Branch on `code`, not `message` or `statusCode`

`message` is localized/human text and `statusCode` can be shared by many causes.
`code` is the stable contract. The published SDK re-exports the enum:

```ts
import { AppErrorCode } from '@healthy-stellar/sdk';

try {
  await updateRecord(id, patch, { ifMatch: version });
} catch (err) {
  switch (err.code) {
    case AppErrorCode.RECORD_VERSION_CONFLICT: // refresh + retry
    case AppErrorCode.ACCESS_DENIED: // show "not allowed"
    case AppErrorCode.TOO_MANY_REQUESTS: // back off, honor Retry-After
    default: // generic handling
  }
}
```

> **FHIR endpoints are the exception.** Routes under `/fhir` return an HL7 FHIR
> [`OperationOutcome`](#fhir-operationoutcome) instead of this envelope.

---

## Error-code catalog

All values of `AppErrorCode`
([`src/common/exceptions/error-codes.ts`](../src/common/exceptions/error-codes.ts)) —
**44 codes** today.

**Retryable** legend:

- **No** — deterministic; fix the request/state. Retrying as-is will fail again.
- **Yes** — transient; safe to retry (use exponential backoff; honor `Retry-After` when present).
- **Conditional** — retry only after a specific action (re-authenticate, refresh version, complete MFA, free quota, …).

> **How status and code are assigned.** `GlobalExceptionFilter` takes the HTTP
> status from the thrown exception (`exception.getStatus()`) and the `code` from
> the exception body when it sets one (`resp.code`), otherwise it derives the code
> from the status via `HTTP_STATUS_TO_ERROR_CODE`. Statuses marked ✅ below are
> backed by a typed exception or an explicit mapping in code; the remaining
> domain statuses are the conventional mapping for that code.

### Generic HTTP

| Code                   | HTTP         | Meaning                                                                                                | Retryable                 |
| ---------------------- | ------------ | ------------------------------------------------------------------------------------------------------ | ------------------------- |
| `BAD_REQUEST`          | 400 ✅       | Malformed request or invalid payload.                                                                  | No                        |
| `UNAUTHORIZED`         | 401 ✅       | Missing or invalid authentication.                                                                     | No                        |
| `FORBIDDEN`            | 403 ✅       | Authenticated but not permitted.                                                                       | No                        |
| `NOT_FOUND`            | 404 ✅       | Generic "resource does not exist".                                                                     | No                        |
| `CONFLICT`             | 409 ✅       | Generic resource conflict.                                                                             | Conditional               |
| `VALIDATION_ERROR`     | 400 / 422 ✅ | Request failed validation (validation pipe → 400; status-mapped → 422). Field errors are in `details`. | No                        |
| `UNPROCESSABLE_ENTITY` | 422          | Syntactically valid but semantically invalid.                                                          | No                        |
| `TOO_MANY_REQUESTS`    | 429 ✅       | Rate limit exceeded.                                                                                   | Yes (honor `Retry-After`) |
| `INTERNAL_ERROR`       | 500 ✅       | Unhandled server error. Message is generic; details are logged only.                                   | Conditional (backoff)     |
| `BAD_GATEWAY`          | 502 ✅       | An upstream dependency returned an invalid response.                                                   | Yes                       |
| `SERVICE_UNAVAILABLE`  | 503 ✅       | Temporarily unavailable (includes an open circuit breaker).                                            | Yes (honor `Retry-After`) |
| `UNKNOWN_ERROR`        | varies       | Fallback when a status has no mapped code.                                                             | No                        |

### Records

| Code                      | HTTP   | Meaning                                           | Retryable                                        |
| ------------------------- | ------ | ------------------------------------------------- | ------------------------------------------------ |
| `RECORD_NOT_FOUND`        | 404 ✅ | Requested medical record does not exist.          | No                                               |
| `RECORD_ALREADY_EXISTS`   | 409    | Record already exists (duplicate create).         | No                                               |
| `RECORD_ACCESS_DENIED`    | 403    | Not permitted to access this record.              | No                                               |
| `RECORD_UPLOAD_FAILED`    | 502    | Uploading a record/attachment to storage failed.  | Yes                                              |
| `RECORD_VERSION_CONFLICT` | 409 ✅ | Optimistic-locking / `If-Match` version mismatch. | Conditional (refresh, retry with new `If-Match`) |

### Access control

| Code                     | HTTP   | Meaning                                   | Retryable                         |
| ------------------------ | ------ | ----------------------------------------- | --------------------------------- |
| `ACCESS_DENIED`          | 403 ✅ | Access-control policy denied the request. | No                                |
| `ACCESS_GRANT_NOT_FOUND` | 404    | Referenced access grant does not exist.   | No                                |
| `ACCESS_GRANT_EXPIRED`   | 403    | Access grant has expired.                 | Conditional (request a new grant) |
| `ACCESS_GRANT_REVOKED`   | 403    | Access grant was revoked.                 | No                                |

### Patients

| Code                | HTTP   | Meaning                                      | Retryable |
| ------------------- | ------ | -------------------------------------------- | --------- |
| `PATIENT_NOT_FOUND` | 404 ✅ | Patient does not exist.                      | No        |
| `PATIENT_DUPLICATE` | 409    | Patient already exists / duplicate identity. | No        |

### Providers / users

| Code                  | HTTP | Meaning                                 | Retryable                                 |
| --------------------- | ---- | --------------------------------------- | ----------------------------------------- |
| `USER_NOT_FOUND`      | 404  | User/provider does not exist.           | No                                        |
| `USER_ALREADY_EXISTS` | 409  | User already exists (e.g. email taken). | No                                        |
| `INVALID_CREDENTIALS` | 401  | Incorrect username/password.            | No                                        |
| `SESSION_EXPIRED`     | 401  | Session/token expired.                  | Conditional (re-authenticate, then retry) |
| `MFA_REQUIRED`        | 401  | A multi-factor challenge is required.   | Conditional (complete MFA)                |

### Tenant

| Code               | HTTP   | Meaning                | Retryable |
| ------------------ | ------ | ---------------------- | --------- |
| `TENANT_NOT_FOUND` | 404 ✅ | Tenant does not exist. | No        |
| `TENANT_SUSPENDED` | 403    | Tenant is suspended.   | No        |

### Stellar / blockchain

| Code                        | HTTP   | Meaning                                                                                      | Retryable                                   |
| --------------------------- | ------ | -------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `STELLAR_TRANSACTION_ERROR` | 502 ✅ | Transaction submission/execution failed. `details` may include `txHash`, `stellarErrorCode`. | Conditional (some causes are deterministic) |
| `STELLAR_CONTRACT_ERROR`    | 502    | Soroban contract invocation failed.                                                          | Conditional                                 |
| `STELLAR_NETWORK_ERROR`     | 503    | Cannot reach Stellar/Horizon (transient).                                                    | Yes                                         |

### IPFS / storage

| Code                     | HTTP   | Meaning                         | Retryable                 |
| ------------------------ | ------ | ------------------------------- | ------------------------- |
| `IPFS_UPLOAD_ERROR`      | 502 ✅ | IPFS pin/upload failed.         | Yes                       |
| `IPFS_FETCH_ERROR`       | 502    | IPFS retrieval failed.          | Yes                       |
| `STORAGE_QUOTA_EXCEEDED` | 403    | Tenant storage quota exhausted. | No (free quota / upgrade) |

### Encryption / key management

| Code                  | HTTP | Meaning                               | Retryable                    |
| --------------------- | ---- | ------------------------------------- | ---------------------------- |
| `ENCRYPTION_ERROR`    | 500  | An encrypt/decrypt operation failed.  | No                           |
| `KEY_NOT_FOUND`       | 500  | Required key material is unavailable. | No                           |
| `KEY_ROTATION_FAILED` | 500  | KEK/DEK rotation failed.              | Conditional (retry rotation) |

### GraphQL / subscriptions

| Code                         | HTTP | Meaning                                       | Retryable                            |
| ---------------------------- | ---- | --------------------------------------------- | ------------------------------------ |
| `SUBSCRIPTION_LIMIT_REACHED` | 429  | Max concurrent GraphQL subscriptions reached. | Conditional (close some, then retry) |
| `SUBSCRIPTION_UNAUTHORIZED`  | 401  | Subscription is not authenticated.            | No                                   |
| `SUBSCRIPTION_FORBIDDEN`     | 403  | Not authorized for this subscription.         | No                                   |

### FHIR

| Code                    | HTTP   | Meaning                                                       | Retryable |
| ----------------------- | ------ | ------------------------------------------------------------- | --------- |
| `FHIR_MAPPING_ERROR`    | 500    | Failed to map between the internal model and a FHIR resource. | No        |
| `FHIR_VALIDATION_ERROR` | 400 ✅ | A FHIR resource failed validation.                            | No        |

---

## Exception filters: what handles what

Several exception filters are registered. This section documents the **actual
runtime behavior**, which differs from older README text.

### Registered filters

Global filters, in the order NestJS stores them:

| #   | Filter                          | Registered in                  | `@Catch` scope                               | Produces                                            |
| --- | ------------------------------- | ------------------------------ | -------------------------------------------- | --------------------------------------------------- |
| 1   | `MedicalEmergencyErrorFilter`   | `app.module.ts` (`APP_FILTER`) | `@Catch()` (all)                             | HIPAA "safe" body via `HIPAACCompliantErrorHandler` |
| 2   | `CircuitBreakerExceptionFilter` | `app.module.ts` (`APP_FILTER`) | `BrokenCircuitError`, `CircuitOpenException` | `503` + `Retry-After`                               |
| 3   | `I18nExceptionFilter`           | `app.module.ts` (`APP_FILTER`) | `HttpException`                              | Translated message body                             |
| 4   | `CustomI18nValidationFilter`    | `main.ts` (`useGlobalFilters`) | `I18nValidationException`                    | Translated validation errors                        |
| 5   | `GlobalExceptionFilter`         | `main.ts` (`useGlobalFilters`) | `@Catch()` (all)                             | **The standard envelope + `AppErrorCode`**          |

Controller-scoped filters (declared with `@UseFilters`, so they only apply to their controller):

| Controller                          | Filter                        | Produces                |
| ----------------------------------- | ----------------------------- | ----------------------- |
| `FhirController` (`/fhir/r4/**`)    | `FhirExceptionFilter`         | FHIR `OperationOutcome` |
| `MedicalRecordsValidatedController` | `MedicalEmergencyErrorFilter` | HIPAA "safe" body       |

### Resolution order (NestJS)

For each request NestJS builds an ordered list `[global…, controller…, method…]`,
**reverses** it, then selects the **first** filter whose `@Catch` list is either
empty (a catch-all) or matches the thrown type via `instanceof`. Two consequences
matter here:

1. **Controller/method filters beat global filters.** So `/fhir/r4/**` is handled by
   `FhirExceptionFilter` and `MedicalRecordsValidatedController` by
   `MedicalEmergencyErrorFilter`.
2. **Among globals, the last-registered is consulted first.** `useGlobalFilters()`
   runs in `bootstrap()` _after_ `APP_FILTER` providers are registered during
   `NestFactory.create()`, so `GlobalExceptionFilter` (#5) is last-registered →
   consulted first → and, being a catch-all, it matches everything.

**Net effect:** on any route that does _not_ declare its own controller filter,
**`GlobalExceptionFilter` handles the error** and emits the standard envelope. The
other four global filters (`MedicalEmergencyErrorFilter`,
`CircuitBreakerExceptionFilter`, `I18nExceptionFilter`,
`CustomI18nValidationFilter`) are registered but **shadowed** at the global level —
they only run where wired at controller scope. Keep this in mind before adding
behavior to those filters and expecting it on all routes.

`GlobalExceptionFilter` also special-cases any remaining `/fhir*` path (a request
that reaches it rather than the controller filter) and returns an
`OperationOutcome`.

---

## Sanitization

`GlobalExceptionFilter` never leaks internals to clients, in **any** environment:

- **Unexpected / non-HTTP errors** (`Error`, thrown libraries, etc.) are reduced to
  `500` + `code: INTERNAL_ERROR` + the generic message `"An unexpected error
occurred"`. The real message and stack trace are **logged server-side only**
  (`logger.error`, prefixed with the `traceId`) and are never placed in the
  response body.
- **Known `HttpException`s** return their own `message`/`details`, which are
  developer-authored and intended to be safe.
- Stack traces are never serialized into a response.

> Note: this sanitization is **unconditional**, not gated on `NODE_ENV`. Earlier
> README wording ("sanitizes messages in production") was imprecise — internal
> details are withheld in every environment.

---

## `traceId`, logs, and tracing

There are **two distinct identifiers**; don't conflate them.

### 1. `traceId` in the error body — log correlation

`GlobalExceptionFilter` mints a fresh `uuidv4()` for each error and:

- returns it as the `traceId` field of the envelope, and
- writes it to the application log, prefixed in brackets:
  `[<traceId>] <METHOD> <url> - <message>` (`warn` for 4xx, `error` + stack for 5xx).

**For a support request:** quote the `traceId` from the error body. Support can
grep the logs for `[<traceId>]` to find the exact line and, for `5xx`, the stack
trace — without needing timestamps or user details.

### 2. `X-Trace-ID` / `X-Request-ID` headers — distributed tracing

Separately, the app emits OpenTelemetry traces ([`src/tracing.ts`](../src/tracing.ts),
exported over OTLP). Two globally-applied components set response headers:

- [`RequestContextMiddleware`](../src/common/middleware/request-context.middleware.ts) — sets `X-Trace-ID` (the OTel trace id, or an inbound `x-trace-id`, or a random UUID) and `X-Request-ID`.
- [`TracingInterceptor`](../src/common/interceptors/tracing.interceptor.ts) — opens a server span per request and sets `X-Trace-ID` to that span's trace id.

`X-Trace-ID` is a **32-hex W3C trace id** and correlates the request across the
distributed trace (spans, DB, Redis, queue). It is a _different value_ from the
envelope's `traceId` (a UUID v4 tied to one error log line). Both are exposed via
CORS (`exposedHeaders`). For cross-service investigation use `X-Trace-ID`; to pull
the server-side error log line use the body `traceId`.

---

## FHIR `OperationOutcome`

Routes under `/fhir` (handled by `FhirExceptionFilter`, or the FHIR branch of
`GlobalExceptionFilter`) return `application/fhir+json` with an HL7 FHIR R4
`OperationOutcome` **instead of** the standard envelope:

```json
{
  "resourceType": "OperationOutcome",
  "issue": [
    {
      "severity": "error",
      "code": "conflict",
      "diagnostics": "Resource version conflict",
      "expression": ["RECORD_VERSION_CONFLICT"]
    }
  ]
}
```

`issue[].code` mapping: `not-found` (404), `invalid` (400), `conflict` (409),
`security` (401/403), otherwise `exception`. `severity` is `error` for 5xx and
`warning` for 4xx. When the underlying exception carries an `AppErrorCode`, it is
surfaced in `issue[].expression`. Optimistic locking uses the `If-Match` header
with the resource `ETag`/`versionId`.

---

## Domain-specific error enums

Some domains define their **own** code enums that are _not_ part of
`AppErrorCode` and do **not** appear in the envelope's top-level `code`. They
travel inside a successful response payload or in `details`.

Example — [`PrescriptionValidationErrorCode`](../src/pharmacy/errors/prescription-validation.error.ts),
returned by the prescription-validation service in `ValidationResult.errors[]`
(each entry has `code`, `description`, and `severity` of `major`/`critical`):

| Code                     | Meaning                                                                   |
| ------------------------ | ------------------------------------------------------------------------- |
| `DEA_NUMBER_REQUIRED`    | A valid DEA registration number is required (e.g. controlled substances). |
| `SCHEDULE_II_NO_REFILLS` | Schedule II prescriptions may not have refills.                           |
| `SCHEDULE_II_EXPIRED`    | Schedule II prescription exceeds the maximum fill age.                    |
| `PDMP_FLAG`              | A PDMP (prescription drug monitoring program) review flagged the patient. |

When adding a new domain error, prefer an existing `AppErrorCode` for the envelope
`code`, and use a domain enum only for finer-grained detail inside `details` or a
domain payload.
