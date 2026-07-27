# Changelog

All notable changes to this project are documented in this file. This
project uses [Semantic Versioning](https://semver.org/) for
`packages/sdk` releases (tagged `v*`, see
`.github/workflows/publish-sdk.yml`), and follows the
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format.

Entries are grouped as `Added`, `Changed`, `Fixed`, `Deprecated`, `Removed`,
and `Security`. Every PR with a user-visible or API-visible change —
especially anything affecting `packages/sdk` consumers — should add an entry
under `[Unreleased]` (see [CONTRIBUTING.md](CONTRIBUTING.md)).

## [Unreleased]

### Fixed

- Hospital transfer acceptance (`TransferService.acceptTransfer`) now runs
  record-sharing, access-revocation, and the transfer's completion write in
  a single database transaction. A failure in any step now rolls back and
  propagates the error instead of being logged and swallowed while the
  transfer is still marked `COMPLETED`. (#833)
- Event projection checkpoints (`record`, `access-grant`, `audit`,
  `analytics` projectors) are now tracked per `(projector, aggregate)` pair
  instead of as a single global counter per projector. Event-store versions
  are scoped per-aggregate, so a global checkpoint could cause events from
  one aggregate to be silently skipped once another aggregate's version had
  advanced past them, resulting in missed access grants, missed audit
  entries, and undercounted analytics. (#834)

### Added

- `CONTRIBUTING.md` with setup, branching, commit, and testing conventions.
- `CHANGELOG.md` (this file).
- Swagger/OpenAPI decorators (`@ApiTags` and related) on controllers that
  previously had none, so they render correctly in the Swagger UI at `/api`. (#788)

[Unreleased]: https://github.com/Healthy-Stellar/Healthy-Stellar-backend/compare/main...HEAD
