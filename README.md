# Handsoff

Handsoff is a NestJS backend for clinical operations: patient records, appointments, pharmacy, laboratory, analytics, and integrations.

## Getting started

```bash
npm install
npm run start:dev
```

The API is served under the global prefix `/api`. Swagger docs are available at `/api/docs`.

## Route overview

Routes are grouped by module. Only routes registered in a module's `controllers` array are served; any controller not listed there is not exposed.

- `/auth` — authentication and session management
- `/users` — user accounts and roles
- `/patients` — patient records
- `/appointments` — scheduling
- `/pharmacy` — prescriptions, dispensing, and inventory
- `/laboratory` — lab orders and results
- `/analytics` — reporting and dashboards
- `/integrations` — external system integrations

## Contributing

- Keep controllers registered in a module and protected by `JwtAuthGuard` + `RolesGuard`.
- Derive actor ids from `req.user`, never from request bodies.
- Update this route list whenever a module's registered controllers change.
