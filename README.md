# Healthcare Backend

A production-grade healthcare backend built with NestJS, PostgreSQL, Redis, and Stellar.

## Deployment

### Single-scheduler requirement (distributed cron locking)

This application schedules background work with `@Cron` decorators (subscription
renewals, appointment reminders, notification digests, compliance reports, backups,
escalations, cleanups, and more). When the API runs with more than one replica, every
replica would otherwise execute every scheduled job, producing duplicate charges,
emails, reports, and concurrent `pg_dump`s.

To prevent this, scheduled jobs are guarded by a shared `@WithDistributedLock()`
decorator backed by `RedisLockService`. Each job acquires a Redis lock keyed by the
job name and the current tick before running; replicas that fail to acquire the lock
skip that tick. Lock acquisition failures are logged and treated as a skip rather
than a crash.

Operational requirements:

- A shared Redis instance MUST be reachable by all replicas so the lock is visible
  cluster-wide. Do not run replicas against isolated Redis instances.
- Keep replica clocks reasonably synchronized (NTP) so tick keys align.
- If you prefer a dedicated scheduler process, run exactly one replica with
  `SCHEDULER_ENABLED=true` and set it to `false` on the others; the distributed lock
  remains a safety net for rolling deploys and misconfiguration.

## Getting Started

```bash
npm install
npm run start:dev
```

See `docker-compose.yml` for a local stack with PostgreSQL and Redis.
