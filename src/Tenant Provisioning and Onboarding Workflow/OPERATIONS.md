# Deployment and Operations Guide

## Deployment Checklist

### Pre-Deployment

- [ ] All tests passing: `npm run test && npm run test:e2e`
- [ ] Code linted and formatted: `npm run lint && npm run format`
- [ ] Build successful: `npm run build`
- [ ] No security vulnerabilities: `npm audit`
- [ ] Environment variables documented
- [ ] Database backups configured
- [ ] Monitoring setup planned
- [ ] API documentation reviewed
- [ ] Load testing completed (optional)
- [ ] Disaster recovery plan documented

### Database Preparation

```bash
# Create production database
createdb -U postgres tenant_provisioning_prod

# Run migrations in production environment
NODE_ENV=production npm run migration:run

# Verify schema created
psql -U postgres -d tenant_provisioning_prod -c "\\dt public.*"
```

### Environment Setup

**.env.production**:

```env
NODE_ENV=production
APP_PORT=3000
APP_URL=https://api.healthcare-platform.com

# Database (Production)
DB_HOST=prod-db.aws.rds.amazonaws.com
DB_PORT=5432
DB_USERNAME=admin
DB_PASSWORD=<strong-password>
DB_NAME=tenant_provisioning_prod

# Redis (Production)
REDIS_HOST=prod-redis.aws.elasticache.amazonaws.com
REDIS_PORT=6379
REDIS_PASSWORD=<strong-password>

# JWT
JWT_SECRET=<long-random-secret-key-min-64-chars>
JWT_EXPIRATION=24h

# Email (Production)
MAIL_HOST=smtp.sendgrid.net
MAIL_PORT=587
MAIL_USER=apikey
MAIL_PASSWORD=<sendgrid-api-key>
MAIL_FROM=Healthcare Platform <noreply@healthcare-platform.com>

# Stellar/Soroban (Mainnet)
SOROBAN_NETWORK=public
SOROBAN_RPC_URL=https://soroban-mainnet.stellar.org
SOROBAN_CONTRACT_DEPLOYER_SECRET=<stellar-keypair-secret>
```

## Docker Deployment

### Build Docker Image

```bash
# Build image
docker build -t healthcare/tenant-provisioning:1.0.0 .

# Tag for registry
docker tag healthcare/tenant-provisioning:1.0.0 \
  registry.healthcare.com/tenant-provisioning:1.0.0

# Push to registry
docker push registry.healthcare.com/tenant-provisioning:1.0.0
```

### Docker Run

```bash
docker run \
  -p 3000:3000 \
  --env-file .env.production \
  --name tenant-provisioning \
  -d \
  healthcare/tenant-provisioning:1.0.0
```

### Docker Compose (Production)

```yaml
version: '3.8'

services:
  app:
    image: healthcare/tenant-provisioning:1.0.0
    container_name: tenant-provisioning-app
    ports:
      - '3000:3000'
    environment:
      NODE_ENV: production
      DB_HOST: postgres
      REDIS_HOST: redis
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:3000/health']
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  postgres:
    image: postgres:15-alpine
    container_name: tenant-provisioning-db
    environment:
      POSTGRES_DB: tenant_provisioning_prod
      POSTGRES_PASSWORD: <strong-password>
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups:/backups
    restart: unless-stopped
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U postgres']
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: tenant-provisioning-redis
    command: redis-server --requirepass <strong-password>
    volumes:
      - redis_data:/data
    restart: unless-stopped
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
  redis_data:
```

## Kubernetes Deployment

### Namespace and ConfigMap

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: healthcare

---
apiVersion: v1
kind: ConfigMap
metadata:
  name: tenant-provisioning-config
  namespace: healthcare
data:
  NODE_ENV: 'production'
  APP_PORT: '3000'
```

### Secrets

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: tenant-provisioning-secrets
  namespace: healthcare
type: Opaque
stringData:
  DB_PASSWORD: '<strong-password>'
  REDIS_PASSWORD: '<strong-password>'
  JWT_SECRET: '<long-random-secret-key>'
  MAIL_PASSWORD: '<sendgrid-api-key>'
  SOROBAN_SECRET: '<stellar-secret>'
```

### Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: tenant-provisioning
  namespace: healthcare
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: tenant-provisioning
  template:
    metadata:
      labels:
        app: tenant-provisioning
    spec:
      containers:
        - name: app
          image: healthcare/tenant-provisioning:1.0.0
          imagePullPolicy: IfNotPresent
          ports:
            - containerPort: 3000
              name: http

          env:
            - name: NODE_ENV
              valueFrom:
                configMapKeyRef:
                  name: tenant-provisioning-config
                  key: NODE_ENV
            - name: DB_HOST
              value: postgres.healthcare.svc.cluster.local
            - name: DB_PORT
              value: '5432'
            - name: DB_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: tenant-provisioning-secrets
                  key: DB_PASSWORD
            - name: REDIS_HOST
              value: redis.healthcare.svc.cluster.local
            - name: REDIS_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: tenant-provisioning-secrets
                  key: REDIS_PASSWORD

          resources:
            requests:
              cpu: 250m
              memory: 512Mi
            limits:
              cpu: 500m
              memory: 1Gi

          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 30
            periodSeconds: 10
            timeoutSeconds: 5
            failureThreshold: 3

          readinessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 5
            timeoutSeconds: 3
            failureThreshold: 3

---
apiVersion: v1
kind: Service
metadata:
  name: tenant-provisioning
  namespace: healthcare
spec:
  selector:
    app: tenant-provisioning
  type: LoadBalancer
  ports:
    - port: 80
      targetPort: 3000
      name: http

---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: tenant-provisioning-hpa
  namespace: healthcare
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: tenant-provisioning
  minReplicas: 3
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
```

## Production Monitoring

### Application Metrics Collection

Add Prometheus metrics endpoint:

```typescript
// src/metrics/metrics.controller.ts
import { Controller, Get } from '@nestjs/common';
import { register } from 'prom-client';

@Controller('metrics')
export class MetricsController {
  @Get()
  getMetrics() {
    return register.metrics();
  }
}
```

### Key Metrics to Monitor

```
# Application metrics
provisioning_jobs_total{status="success|failure"}
provisioning_duration_seconds{step="..."}
provisioning_queue_depth
active_tenants
failed_provisionings

# System metrics
nodejs_process_cpu_usage_seconds_total
nodejs_process_resident_memory_bytes
nodejs_process_virtual_memory_bytes

# Database metrics
pg_connections_active
pg_query_duration_seconds
pg_replication_lag

# Redis metrics
redis_connected_clients
redis_used_memory_bytes
redis_commands_processed_total
```

### Prometheus Configuration

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'tenant-provisioning'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
```

### Alert Rules

```yaml
groups:
  - name: tenant_provisioning
    rules:
      - alert: HighProvisioningFailureRate
        expr: |
          rate(provisioning_jobs_total{status="failure"}[5m]) > 0.1
        for: 5m
        annotations:
          summary: 'High provisioning failure rate detected'

      - alert: ProvisioningQueueBacklog
        expr: provisioning_queue_depth > 100
        for: 5m
        annotations:
          summary: 'Provisioning queue backlog growing'

      - alert: DatabaseConnectionPoolExhausted
        expr: pg_connections_active > 90
        for: 2m
        annotations:
          summary: 'PostgreSQL connection pool near capacity'
```

## Operational Procedures

### Health Check

```bash
# Check application health
curl http://localhost:3000/health

# Response:
# {"status": "ok"}
```

### Backup and Recovery

#### Backup Strategy

```bash
#!/bin/bash
# Daily automated backup

BACKUP_DIR="/backups"
DB_NAME="tenant_provisioning_prod"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Dump database
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME \
  | gzip > "$BACKUP_DIR/tenant_provisioning_$TIMESTAMP.sql.gz"

# Upload to S3
aws s3 cp "$BACKUP_DIR/tenant_provisioning_$TIMESTAMP.sql.gz" \
  s3://healthcare-backups/

# Keep last 30 days
find $BACKUP_DIR -name "tenant_provisioning_*.sql.gz" -mtime +30 -delete
```

#### Restore from Backup

```bash
# Restore database from backup
gunzip < "backup_file.sql.gz" | psql -h $DB_HOST -U $DB_USER -d $DB_NAME

# Verify restore
psql -h $DB_HOST -U $DB_USER -d tenant_provisioning_restored \
  -c "SELECT COUNT(*) FROM public.tenants;"
```

### Log Management

#### Centralized Logging

```typescript
// src/logging/logging.module.ts
import { Module } from '@nestjs/common';
import * as winston from 'winston';

@Module({
  providers: [
    {
      provide: 'LOGGER',
      useValue: winston.createLogger({
        level: 'info',
        format: winston.format.json(),
        transports: [
          new winston.transports.File({
            filename: 'logs/error.log',
            level: 'error',
          }),
          new winston.transports.File({
            filename: 'logs/combined.log',
          }),
          // Optionally send to CloudWatch, Splunk, etc.
        ],
      }),
    },
  ],
})
export class LoggingModule {}
```

#### Log Retention

```bash
# Keep logs for 30 days
find /var/log/tenant-provisioning -name "*.log" -mtime +30 -delete

# Archive older logs
find /var/log/tenant-provisioning -name "*.log" -mtime +7 | gzip
```

### Scaling Guidelines

#### Vertical Scaling

```
Available CPU/Memory | Recommended Replicas | Throughput
1-2 CPU, 2GB RAM    | 1-2 replicas         | 50+ tenants/day
4 CPU, 8GB RAM      | 3-5 replicas         | 200+ tenants/day
8+ CPU, 16GB RAM    | 5-10 replicas        | 500+ tenants/day
```

#### Horizontal Scaling

```bash
# Kubernetes
kubectl scale deployment tenant-provisioning --replicas=5 -n healthcare

# Docker Swarm
docker service scale tenant-provisioning=5
```

### Performance Tuning

#### PostgreSQL Optimization

```sql
-- Increase work_mem for large operations
ALTER SYSTEM SET work_mem = '256MB';

-- Increase shared_buffers
ALTER SYSTEM SET shared_buffers = '4GB';

-- Enable parallel query execution
ALTER SYSTEM SET max_parallel_workers_per_gather = 4;

-- Apply changes
SELECT pg_reload_conf();
```

#### Redis Optimization

```bash
# Memory management
redis-cli CONFIG SET maxmemory 2gb
redis-cli CONFIG SET maxmemory-policy allkeys-lru

# Persistence
redis-cli CONFIG SET save "900 1 300 10 60 10000"
redis-cli BGSAVE
```

## Troubleshooting Guide

### High Memory Usage

```bash
# Check Node.js memory
process.memoryUsage()

# Check database connections
psql -U postgres -c "SELECT count(*) FROM pg_stat_activity;"

# Check Redis memory
redis-cli INFO memory

# Solutions:
# 1. Increase heap size: NODE_OPTIONS="--max-old-space-size=4096"
# 2. Reduce provisioning parallelism
# 3. Clear old provisioning logs
```

### Database Connection Issues

```bash
# Test connection
psql -h $DB_HOST -U $DB_USER -d tenant_provisioning -c "SELECT 1;"

# Check connection pool status
SELECT count(*) as total_connections,
       count(CASE WHEN state = 'active' THEN 1 END) as active
FROM pg_stat_activity;

# Solutions:
# 1. Check firewall/security groups
# 2. Verify credentials
# 3. Increase max_connections setting
```

### Slow Provisioning

```bash
# Check query performance
EXPLAIN ANALYZE SELECT * FROM tenants WHERE status = 'PROVISIONING';

# Check provisioning logs for slow steps
SELECT step, AVG(duration_ms)
FROM provisioning_logs
GROUP BY step
ORDER BY avg DESC;

# Solutions:
# 1. Add indexes on frequently queried columns
# 2. Archive old provisioning logs
# 3. Optimize step implementations
```

### Redis Queue Issues

```bash
# Check queue depth
redis-cli LLEN bull:provisioning:

# Check failed jobs
redis-cli HGETALL bull:provisioning:failed

# Clear queue (CAUTION: Lose jobs)
redis-cli DEL bull:provisioning:*

# Restart Redis
systemctl restart redis-server
```

## Rollback Procedures

### Application Rollback

```bash
# Kubernetes rollback
kubectl rollout history deployment/tenant-provisioning -n healthcare
kubectl rollout undo deployment/tenant-provisioning -n healthcare

# Docker Compose rollback
docker-compose down
docker-compose up -d  # Uses previous image
```

### Database Rollback

```bash
# Restore from backup
gunzip < backup_20260221_100000.sql.gz | psql -d tenant_provisioning

# Verify restore
psql -d tenant_provisioning -c "SELECT COUNT(*) FROM tenants;"
```

### Partial Rollback

```bash
# If specific provisioning failed, manual intervention:
1. Identify failed tenant
2. Check provisioning_logs for which step failed
3. Manually rollback schema if needed
4. Update tenant status
5. Retry provisioning
```

## Incident Response

### Response Plan

1. **Detection** (0 min)
   - Monitoring alert triggered
   - On-call engineer notified

2. **Assessment** (5 min)
   - Check logs and metrics
   - Determine scope (single tenant, all, etc.)

3. **Mitigation** (15 min)
   - Reduce impact
   - Prevent further issues

4. **Resolution** (varies)
   - Fix root cause
   - Deploy fix if needed

5. **Verification** (varies)
   - Confirm normal operation
   - Test recovery

6. **Postmortem** (next business day)
   - Document incident
   - Plan preventive measures

### Common Incident Scenarios

**Scenario: Provisioning Jobs Stuck**

```
1. Check queue depth: redis-cli LLEN bull:provisioning:
2. Check processor logs for errors
3. Verify database connection
4. Restart processor if needed
5. Monitor to ensure jobs process
```

**Scenario: Database Full**

```
1. Check disk usage: df -h
2. Archive old logs/data
3. Increase disk space
4. Monitor disk usage going forward
```

**Scenario: Email Service Down**

```
1. Check SMTP connectivity
2. Verify MAIL_* environment variables
3. Retry failed emails manually
4. Switch to backup email provider if available
```

## Maintenance Windows

### Scheduled Maintenance

```
Standard Maintenance Window:
  - Day: Second Sunday of each month
  - Time: 02:00 - 04:00 UTC (low traffic)
  - Maintenance Items:
    - Apply security patches
    - Database maintenance (VACUUM, ANALYZE)
    - Log rotation and cleanup
    - Backup verification
```

### Maintenance Notification

```bash
# Pre-maintenance (24 hours before)
- Send email notification
- Update status page
- Set maintenance mode if needed

# During maintenance
- Redirect traffic if necessary
- Keep audit logs of all changes

# Post-maintenance
- Verify all systems operational
- Send completion notification
- Update status page
```

## Documentation

- Keep README.md current with features
- Update API.md with endpoint changes
- Maintain ARCHITECTURE.md as reference
- Document operational changes in OPERATIONS.md (this file)
- Create runbooks for common procedures

## Support Contacts

- **On-Call Engineer**: escalation@healthcare-platform.com
- **Database Admin**: dba@healthcare-platform.com
- **Security Team**: security@healthcare-platform.com
- **Platform Team**: platform@healthcare-platform.com
