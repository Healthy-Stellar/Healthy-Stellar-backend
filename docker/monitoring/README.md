# Monitoring & Alerting

Prometheus scrapes the app `/metrics` endpoint and evaluates the rule files listed
in `prometheus.yml`. Alerts are dispatched through Alertmanager (`alertmanager.yml`).

## Rule files

| File | Purpose |
| --- | --- |
| `app-alerts.yml` | General application health (error rate, CPU/memory, dependencies) |
| `slo-rules.yml` / `slo-alerts.yml` | SLO recording rules and burn-rate alerts |
| `medical_alerts.yml` | Domain-specific medical workflow alerts |
| `sla-alerts.yml` | **SLA-critical endpoint alerts** (patient reads, auth, queues) |

## SLA-critical endpoint alerts (`sla-alerts.yml`)

| Alert | Condition | Window |
| --- | --- | --- |
| `PatientsP99LatencyHigh` | p99 latency of `/patients/*` > 2s | 5m |
| `AuthErrorRateHigh` | 5xx error rate of `/auth/*` > 1% | 2m |
| `BullMQQueueDepthHigh` | BullMQ `queue_depth` > 1000 | 10m |

Each alert is labelled `notify: sla-critical` and includes a `runbook_url`
annotation linking to the matching operator runbook (`src/operator-runbook/`,
served at `/operator/runbooks/<slug>`).

## Notification routing

`alertmanager.yml` routes `notify=sla-critical` alerts to the
`sla-critical-receiver`, which fans out to **email** and **Slack**. Provide the
following environment variables / secrets when deploying Alertmanager:

| Variable | Description |
| --- | --- |
| `SLA_ALERT_EMAIL` | Destination email (default `oncall@healthystellar.io`) |
| `ALERT_FROM_EMAIL` | From address |
| `SMTP_SMARTHOST`, `SMTP_USERNAME`, `SMTP_PASSWORD` | SMTP relay credentials |
| `SLACK_WEBHOOK_URL` | Slack incoming webhook URL |
| `SLACK_ALERT_CHANNEL` | Slack channel (default `#sla-alerts`) |

## Validation

```bash
# Check rule syntax
promtool check rules docker/monitoring/sla-alerts.yml
# Check Alertmanager config
amtool check-config docker/monitoring/alertmanager.yml
```
