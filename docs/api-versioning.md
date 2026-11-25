# API versioning

This service uses URI-based API versioning. Clients should use an explicit
version prefix so that their behavior does not depend on the compatibility
alias for unversioned routes.

## Version resolution

Versioned routes use the form `/v{version}/...`, for example:

```text
GET /v1/patients
```

The application currently configures v1 as the default version and also keeps
Nest's version-neutral behavior enabled. As a result, routes that are not
explicitly versioned may be reachable without a `/v1` prefix, while the
lifecycle interceptor treats the unversioned request as v1 for response
metadata. The unversioned form is a compatibility alias, not a separate API
contract, and may be removed in a future breaking change. New integrations
should use `/v1/...` explicitly.

The version-neutral discovery endpoint is available at:

```text
GET /api
```

It returns the lifecycle metadata currently published by the service,
including each version's status, release date, base URL, sunset date, and
changelog link when provided.

## Lifecycle policy

### v1

v1 is the current API version. Its changelog and migration information are
maintained in this document under [v1](#v1).

### v2

The lifecycle policy currently records v2 as deprecated, released on
2025-01-01, with a sunset date of 2027-01-01 and v3 as its replacement. The
repository does not currently contain a general production v2 or v3 route
set; v2/v3 entries also appear in routing tests to exercise lifecycle
behavior. Therefore, this metadata describes the planned migration lifecycle,
not a guarantee that every endpoint is available under `/v2` or `/v3` in every
deployment. Consumers should use `/api` and the deployed route documentation
to confirm availability.

The published v2 changelog link resolves to [v2](#v2). No v2 route should be
assumed to remain available after the published sunset date.

### Lifecycle states

- `current`: the supported version for new integrations.
- `deprecated`: still served, but clients should migrate to the replacement.
  Deprecated responses include lifecycle headers.
- `sunset`: no longer served. Requests receive HTTP 410 Gone when the sunset
  date has passed.

The minimum planned deprecation window is 12 months between a public
deprecation announcement and sunset, except where an urgent security or legal
requirement makes a shorter window necessary. The current v2 policy provides
24 months between its release date and sunset date.

## Response headers

The lifecycle interceptor adds these headers when it can resolve an API
version:

| Header | Meaning |
|---|---|
| `API-Version` | Effective version, such as `v1`. |
| `API-Version-Status` | Lifecycle state: `current`, `deprecated`, or `sunset`. |
| `Deprecation` | `true`, or the planned sunset date for a deprecated version. |
| `Sunset` | Planned removal date when one is scheduled. |
| `Link` | Migration documentation and, when configured, the replacement route. |

Example response from a deprecated version:

```http
HTTP/1.1 200 OK
API-Version: v2
API-Version-Status: deprecated
Deprecation: Wed, 01 Jan 2027 00:00:00 GMT
Sunset: Wed, 01 Jan 2027 00:00:00 GMT
Link: <https://github.com/Healthy-Stellar/Healthy-Stellar-backend/blob/main/docs/api-versioning.md>; rel="help", </v3>; rel="alternate"
```

After sunset, the request is rejected with HTTP 410 and the response message
identifies the sunset date and replacement version when available.

## Contributors

### Deprecating an endpoint

Use `DeprecatedRoute` on the handler or controller and provide a sunset date.
When applicable, include the replacement route and a short reason:

```ts
@DeprecatedRoute({
  sunsetDate: 'Wed, 01 Jan 2027 00:00:00 GMT',
  alternativeRoute: '/v1/new-route',
  reason: 'Use the replacement route.',
})
@Get('old-route')
getOldRoute() {
  // ...
}
```

Keep the endpoint available through the announced deprecation window. The
deprecation interceptor emits `Deprecation`, `Sunset`, and `Link` headers and
returns HTTP 410 after the sunset date.

### Introducing v2 routes

1. Add the new controller or handler with `@Version('2')`.
2. Keep the v1 implementation available while the deprecation window is open.
3. Add or update the v2 lifecycle policy entry with its release date, base URL,
   status, changelog link, and eventual replacement/sunset information.
4. Update this document and the API tests with the supported route behavior.
5. Verify the route through the version-neutral `/api` discovery endpoint and
   the versioned integration tests.

Adding a route alone does not complete a version release: routing, lifecycle
metadata, migration documentation, and tests must agree.

## v1

v1 is the current version and the recommended explicit URI prefix for clients.
Use `/v1/...` for versioned requests.

## v2

v2 is documented here because the lifecycle policy publishes a v2 changelog
link. It is currently a deprecated/planned lifecycle entry rather than a
complete general-purpose production API surface. See the [lifecycle policy](#lifecycle-policy)
for the sunset and replacement details.
