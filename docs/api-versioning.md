# API Versioning Strategy

## Overview

This project uses **URI-based API versioning** provided by NestJS's built-in versioning support.

| Concept                               | Value                 |
| ------------------------------------- | --------------------- |
| Strategy                              | URI prefix (`/v{n}/`) |
| Current stable version                | `v1`                  |
| Default version (unversioned clients) | `1`                   |
| Version-neutral endpoints             | `/health`, `/`        |

---

## URL Structure

```
https://api.medical-system.com/v1/records
https://api.medical-system.com/v2/records   ← future
```

Unversioned requests resolve to the **default version (v1)**:

```
GET /records  →  same as GET /v1/records  ✓ (no breaking change)
```

---

## Version-Neutral Endpoints

The following endpoints respond at **every version** (no prefix required) and
are never broken by version bumps:

| Endpoint      | Purpose                       |
| ------------- | ----------------------------- |
| `GET /health` | Health check / liveness probe |
| `GET /`       | Application root              |

These are decorated with `VERSION_NEUTRAL` in their controllers.

---

## Adding a New Version (v2)

### Option A — New controller alongside existing one

```typescript
@Controller({ path: 'records', version: '2' })
export class RecordsV2Controller {
  @Get()
  findAll() {
    /* v2 implementation */
  }
}
```

Register `RecordsV2Controller` in its module's `controllers` array. No changes
to the existing `RecordsController` are required.

### Option B — Same controller, version-specific methods

```typescript
@Controller('records')
export class RecordsController {
  @Version('1')
  @Get()
  findAllV1() { ... }

  @Version('2')
  @Get()
  findAllV2() { ... }
}
```

---

## Deprecation Lifecycle

Use the `@Deprecated()` decorator to mark a route as deprecated. The
`VersionDeprecationInterceptor` (registered globally) will inject the following
**IETF-standard response headers** on every matching request:

| Header        | Standard                                                                                  | Description                                |
| ------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------ |
| `Deprecation` | [IETF Draft](https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-deprecation-header) | Date the route was deprecated              |
| `Sunset`      | [RFC 8594](https://datatracker.ietf.org/doc/html/rfc8594)                                 | Date after which the route will be removed |
| `Link`        | RFC 5988                                                                                  | URL of the successor endpoint              |

### Example

```typescript
import { Deprecated } from '@/common/decorators/deprecated.decorator';

@Get('old-endpoint')
@Deprecated({
  deprecation: 'Mon, 01 Jul 2026 00:00:00 GMT',
  sunset:      'Sat, 01 Jan 2027 00:00:00 GMT',
  link:        'https://docs.medical-system.com/v2/records',
})
oldEndpoint() {
  // same implementation — headers are injected automatically
}
```

Response headers for any client calling this route:

```http
HTTP/1.1 200 OK
Deprecation: Mon, 01 Jul 2026 00:00:00 GMT
Sunset: Sat, 01 Jan 2027 00:00:00 GMT
Link: <https://docs.medical-system.com/v2/records>; rel="successor-version"
```

---

## Deprecation Schedule Template

When deprecating a v1 route, follow this timeline:

1. **Day 0** — Apply `@Deprecated()` with `deprecation` = today, `sunset` = 6 months later
2. **Day 0** — Announce in changelog and API release notes
3. **Minus 30 days** — Send final deprecation notice to registered API consumers
4. **Sunset date** — Remove the route; return `410 Gone` if needed

---

## CORS

The `Deprecation`, `Sunset`, and `Link` headers are listed in CORS
`exposedHeaders` so browser-based API clients can read them.

---

## Swagger / OpenAPI

The Swagger UI is available at `/api`. Server definitions point to the versioned
base URLs:

- Production: `https://api.medical-system.com/v1`
- Staging: `https://staging-api.medical-system.com/v1`
- Local: `http://localhost:3000/v1`

---

## Testing Versioned Routes

```bash
# v1 explicit
curl -i http://localhost:3000/v1/records

# unversioned (resolves to v1 via defaultVersion)
curl -i http://localhost:3000/records

# health — version-neutral
curl -i http://localhost:3000/health
curl -i http://localhost:3000/v1/health   # also works

# deprecated route — check response headers
curl -si http://localhost:3000/v1/some-deprecated-route | grep -i -E "Sunset|Deprecation|Link"
```
