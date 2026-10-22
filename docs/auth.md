# Authentication & Authorization Guide

This document describes how authentication and authorization work in this codebase. **Read it before writing or reviewing any controller.** Most security defects in this repo come from contributors not knowing these conventions.

---

## TL;DR — the rules

1. **There is no global auth guard.** Every controller that must be protected has to opt in explicitly with `@UseGuards(JwtAuthGuard, ...)`.
2. **`RolesGuard` with no `@Roles()` allows any authenticated user.** Always pair it with `@Roles(...)`.
3. **`AdminGuard`, `PatientPrivacyGuard` and `MedicalRbacGuard` do not authenticate on their own.** They must run *after* `JwtAuthGuard`.
4. **`@RequireAdmin()` and `@HipaaRoles()` only set metadata.** They do nothing unless the matching guard is also applied.
5. **The JWT principal is `{ userId, email, role, mfaEnabled, sessionId, organizationId }`.** There is **no** `id`, **no** `sub`, and **no** `tenantId`. Use `req.user.userId`.
6. **Valid role strings are the `UserRole` enum values.** Never hard-code role strings.

---

## Token issuance and refresh

### Login / issuance

- A user authenticates against the auth module and receives a **short-lived access token** (JWT) and a **refresh token**.
- The access token is a signed JWT whose payload is the principal described below.
- The refresh token is stored/tracked server-side (tied to a `sessionId`) so it can be revoked.

### Refresh

- The client exchanges a valid refresh token for a new access token (and typically a rotated refresh token).
- The new access token carries the **current** `role`, `mfaEnabled`, `organizationId` and `sessionId` — do not assume these are immutable for the lifetime of a session.
- If the session has been revoked or the user's role/MFA state changed, the refresh is rejected and the client must re-authenticate.

### What this means for you

- **Never trust a role cached on the client.** Always read `req.user.role` from the verified token.
- **Never decode the JWT yourself in a controller.** `JwtAuthGuard` has already verified the signature and populated `req.user`.

---

## The JWT principal

After `JwtAuthGuard` runs, `req.user` has exactly this shape:

```ts
interface JwtPrincipal {
  userId: string;          // the user's identifier — use THIS, not `id` or `sub`
  email: string;
  role: UserRole;          // one of the UserRole enum values
  mfaEnabled: boolean;
  sessionId: string;       // identifies the login session (used for revocation)
  organizationId: string;  // the org the session belongs to — use THIS, not `tenantId`
}
```

### Common pitfalls

| Wrong | Right | Why |
| --- | --- | --- |
| `req.user.id` | `req.user.userId` | There is no `id` claim. |
| `req.user.sub` | `req.user.userId` | There is no `sub` claim. |
| `req.user.tenantId` | `req.user.organizationId` | There is no `tenantId` claim. |
| `req.user.roles` | `req.user.role` | The principal carries a single `role`. |

Accessing a non-existent property yields `undefined`, which silently bypasses ownership checks (`undefined === undefined`). This is a real source of privilege-escalation bugs.

---

## Valid roles

Roles are the values of the `UserRole` enum. **Always reference the enum**, never a string literal:

```ts
import { UserRole } from '../auth/enums/user-role.enum';

@Roles(UserRole.ADMIN, UserRole.PHYSICIAN)
```

Do not invent new role strings in a controller. If you need a new role, add it to the `UserRole` enum and update the guards/tests accordingly.

---

## Guard catalogue

Guards run in the order listed in `@UseGuards(...)`. Order matters — see the notes.

### `JwtAuthGuard`

- **Checks:** verifies the JWT signature and expiry, loads the principal, and populates `req.user`.
- **Depends on:** nothing (it is the entry point).
- **Use:** first in every protected controller/handler.
- **Note:** it is **not** global. If you forget it, `req.user` is `undefined` and downstream guards will fail open or throw.

### `RolesGuard`

- **Checks:** that `req.user.role` is in the set declared by `@Roles(...)`.
- **Depends on:** `JwtAuthGuard` (needs `req.user`).
- **⚠️ Pitfall:** with **no `@Roles()` metadata**, `RolesGuard` allows **any authenticated user**. It is not a "deny by default" guard. Always pair it with `@Roles(...)`.

### `AdminGuard`

- **Checks:** that the principal is an admin.
- **Depends on:** `JwtAuthGuard` — it does **not** authenticate on its own.
- **Use:** `@UseGuards(JwtAuthGuard, AdminGuard)`.

### `PatientPrivacyGuard`

- **Checks:** patient-level privacy/ownership rules (e.g. a patient may only access their own record; staff access is scoped).
- **Depends on:** `JwtAuthGuard` — it does **not** authenticate on its own.
- **Use:** `@UseGuards(JwtAuthGuard, PatientPrivacyGuard)`.

### `MedicalRbacGuard`

- **Checks:** medical role-based access (which clinical roles may perform which actions).
- **Depends on:** `JwtAuthGuard` — it does **not** authenticate on its own.
- **Use:** `@UseGuards(JwtAuthGuard, MedicalRbacGuard)`.

### `@RequireAdmin()` decorator

- **Does:** sets metadata only.
- **Depends on:** a guard that reads that metadata (e.g. `AdminGuard`). On its own it enforces **nothing**.
- **Use:** apply the decorator **and** the guard.

### `@HipaaRoles()` decorator

- **Does:** sets HIPAA role metadata only.
- **Depends on:** the guard that consumes it (e.g. `MedicalRbacGuard`). On its own it enforces **nothing**.
- **Use:** apply the decorator **and** the guard.

---

## `@Public()`

- Marks a route as intentionally unauthenticated.
- Use it **only** for genuinely public endpoints (health checks, login, token refresh, public metadata).
- Because there is no global guard, `@Public()` is documentation/defence-in-depth: it makes intent explicit and protects you if a global guard is ever introduced. Do not rely on it to *remove* protection that a controller-level `@UseGuards` would otherwise apply — keep public routes in controllers that are not guarded, or on handlers that are explicitly excluded.

---

## API keys

- Machine-to-machine callers authenticate with an API key rather than a user JWT.
- API-key-authenticated requests are resolved to a principal by the API-key guard/strategy; downstream guards then treat it like any other principal.
- **Never** log API keys, and never accept them from query strings — use the designated header.
- API keys are scoped; do not assume an API key implies admin.

---

## MFA

- `req.user.mfaEnabled` reflects the MFA state at token issuance.
- Endpoints that require MFA must check `mfaEnabled` explicitly (or use a guard that does) — there is no implicit MFA enforcement.
- If MFA is required for an action, reject principals with `mfaEnabled === false` with `403`, not `401`.

---

## SMART scopes

- SMART-on-FHIR scopes (e.g. `patient/*.read`, `user/*.write`) are carried on the token and checked by the relevant guard/strategy for FHIR-facing endpoints.
- Scope checks are **separate** from `UserRole` checks. A user may have a role that permits an action but lack the SMART scope, or vice versa.
- When adding a FHIR endpoint, declare the required scopes explicitly and test both the allowed and denied cases.

---

## Correct controller usage

### Authenticated, role-restricted

```ts
import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/enums/user-role.enum';

@Controller('records')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RecordsController {
  @Get('me')
  @Roles(UserRole.PATIENT, UserRole.PHYSICIAN, UserRole.ADMIN)
  getMine(@Req() req) {
    // ✅ correct claim
    return this.recordsService.findByUser(req.user.userId);
  }
}
```

### Admin-only

```ts
@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  @Get('stats')
  @RequireAdmin() // metadata + guard both required
  stats() { /* ... */ }
}
```

### Patient privacy

```ts
@Controller('patients')
@UseGuards(JwtAuthGuard, PatientPrivacyGuard)
export class PatientsController {
  @Get(':id')
  findOne(@Param('id') id: string, @Req() req) {
    // PatientPrivacyGuard has already verified access to this patient
    return this.patientsService.findOne(id);
  }
}
```

### Public endpoint

```ts
@Controller('health')
export class HealthController {
  @Get()
  @Public()
  check() { return { status: 'ok' }; }
}
```

---

## Common pitfalls (read this twice)

1. **No global auth guard.** Forgetting `@UseGuards(JwtAuthGuard, ...)` leaves the controller **completely open**. There is no safety net.
2. **`RolesGuard` without `@Roles()`.** Allows any authenticated user. Always declare roles.
3. **`AdminGuard` / `PatientPrivacyGuard` / `MedicalRbacGuard` without `JwtAuthGuard`.** They don't authenticate; `req.user` will be `undefined` and the check will fail or throw unpredictably.
4. **`@RequireAdmin()` / `@HipaaRoles()` without the matching guard.** Pure metadata — zero enforcement.
5. **`req.user.id` / `req.user.sub` / `req.user.tenantId`.** These don't exist. Use `req.user.userId` and `req.user.organizationId`.
6. **Hard-coded role strings.** Use `UserRole` enum values.
7. **Assuming MFA is enforced.** Check `req.user.mfaEnabled` where required.
8. **Confusing SMART scopes with roles.** They are independent checks.

---

## New controller security checklist

Before opening a PR that adds or changes a controller, confirm:

- [ ] Every protected handler/controller has `@UseGuards(JwtAuthGuard, ...)`.
- [ ] `RolesGuard` is always accompanied by `@Roles(...)` using `UserRole` enum values.
- [ ] `AdminGuard` / `PatientPrivacyGuard` / `MedicalRbacGuard` are preceded by `JwtAuthGuard`.
- [ ] `@RequireAdmin()` / `@HipaaRoles()` are paired with the guard that consumes them.
- [ ] The principal is read as `req.user.userId` / `req.user.organizationId` (never `id`, `sub`, `tenantId`).
- [ ] MFA-required actions check `req.user.mfaEnabled`.
- [ ] FHIR endpoints declare and test required SMART scopes.
- [ ] `@Public()` is used only for genuinely public routes.
- [ ] Tests cover both the allowed and the denied case.