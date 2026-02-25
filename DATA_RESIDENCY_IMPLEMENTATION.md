# Data Residency Implementation Guide

## Quick Start

### 1. Prerequisites

Ensure you have:
- NestJS 9.0+
- TypeORM 0.3+
- PostgreSQL 13+ (with regional instances)
- Node.js 16+

### 2. Installation & Setup

#### Step 1: Update Environment Variables

Create regional configuration in `.env`:

```bash
# EU Region
STELLAR_HORIZON_EU_URL=https://horizon.eu.stellar.org
IPFS_NODES_EU=https://ipfs-eu-1.infura.io:5001
DB_HOST_EU=postgres-eu.internal.example.com
DB_PORT_EU=5432
DB_NAME_EU=healthy_stellar_eu
DB_USER_EU=postgres
DB_PASSWORD_EU=${DB_PASSWORD}

# US Region
STELLAR_HORIZON_US_URL=https://horizon.us.stellar.org
IPFS_NODES_US=https://ipfs-us-1.infura.io:5001
DB_HOST_US=postgres-us.internal.example.com
DB_PORT_US=5432
DB_NAME_US=healthy_stellar_us
DB_USER_US=postgres
DB_PASSWORD_US=${DB_PASSWORD}

# APAC Region
STELLAR_HORIZON_APAC_URL=https://horizon.apac.stellar.org
IPFS_NODES_APAC=https://ipfs-apac-1.infura.io:5001
DB_HOST_APAC=postgres-apac.internal.example.com
DB_PORT_APAC=5432
DB_NAME_APAC=healthy_stellar_apac
DB_USER_APAC=postgres
DB_PASSWORD_APAC=${DB_PASSWORD}

# AFRICA Region
STELLAR_HORIZON_AFRICA_URL=https://horizon.africa.stellar.org
IPFS_NODES_AFRICA=https://ipfs-africa-1.infura.io:5001
DB_HOST_AFRICA=postgres-africa.internal.example.com
DB_PORT_AFRICA=5432
DB_NAME_AFRICA=healthy_stellar_africa
DB_USER_AFRICA=postgres
DB_PASSWORD_AFRICA=${DB_PASSWORD}
```

#### Step 2: Update App Module

```typescript
import { DataResidencyModule } from './data-residency/data-residency.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '5432'),
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      entities: [/* your entities */],
      synchronize: false,
      migrations: ['src/migrations/*.ts'],
    }),
    DataResidencyModule,
    // ... other modules
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements OnModuleInit {
  constructor(private regionalDb: RegionalDatabaseService) {}

  async onModuleInit() {
    // Initialize regional data sources
    await this.regionalDb.initializeRegionalDataSources({
      type: 'postgres',
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      synchronize: false,
      logging: process.env.NODE_ENV === 'development',
      entities: [/* your entities */],
      migrations: ['src/migrations/*.ts'],
    });
  }
}
```

#### Step 3: Apply Database Migration

```bash
npm run migration:run
```

This will add the `region`, `strictDataResidency`, and `allowedIpRanges` columns to the `tenants` table.

### 3. Using Data Residency in Your Controllers

#### Example 1: Patient Controller with Data Residency

```typescript
import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { DataResidencyGuard } from '../data-residency/guards/data-residency.guard';
import { PatientService } from './patient.service';

@Controller('api/v1/patients')
@UseGuards(DataResidencyGuard)
export class PatientController {
  constructor(private patientService: PatientService) {}

  @Get(':id')
  async getPatient(@Param('id') patientId: string) {
    // DataResidencyGuard ensures the client is in the correct region
    // and attaches region info to request
    return this.patientService.getPatient(patientId);
  }
}
```

#### Example 2: Service with Regional Database Access

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RegionalDatabaseService } from '../data-residency/services/regional-database.service';
import { TenantService } from '../tenant/tenant.service';
import { PatientEntity } from './entities/patient.entity';

@Injectable()
export class PatientService {
  constructor(
    private regionalDb: RegionalDatabaseService,
    private tenantService: TenantService,
    @InjectRepository(PatientEntity)
    private patientRepository: Repository<PatientEntity>,
  ) {}

  async getPatient(patientId: string, tenantId: string): Promise<PatientEntity> {
    // Get tenant to determine region
    const tenant = await this.tenantService.findById(tenantId);

    // Get repository from region-specific data source
    const patientRepo = this.regionalDb.getRepository(
      tenant.region,
      PatientEntity,
    );

    return patientRepo.findOne(patientId);
  }

  async createPatient(
    patientData: CreatePatientDto,
    tenantId: string,
  ): Promise<PatientEntity> {
    const tenant = await this.tenantService.findById(tenantId);
    const patientRepo = this.regionalDb.getRepository(
      tenant.region,
      PatientEntity,
    );

    const patient = patientRepo.create({
      ...patientData,
      tenantId,
    });

    return patientRepo.save(patient);
  }
}
```

#### Example 3: Using Regional IPFS Service

```typescript
import { Injectable } from '@nestjs/common';
import { RegionalIpfsService } from '../data-residency/services/regional-ipfs.service';

@Injectable()
export class DocumentService {
  constructor(private regionalIpfs: RegionalIpfsService) {}

  async storeDocument(
    documentContent: Buffer,
    region: DataResidencyRegion,
  ): Promise<string> {
    // Get region-specific IPFS node
    const ipfsNode = this.regionalIpfs.getIpfsNode(region);

    // Upload to regional IPFS node
    const response = await fetch(`${ipfsNode}/api/v0/add`, {
      method: 'POST',
      body: documentContent,
      headers: {
        'Content-Type': 'application/octet-stream',
      },
    });

    const { Hash } = await response.json();
    return Hash;
  }
}
```

#### Example 4: Using Regional Horizon Service

```typescript
import { Injectable } from '@nestjs/common';
import { RegionalHorizonService } from '../data-residency/services/regional-horizon.service';
import { Account, TransactionBuilder, Keypair } from 'stellar-sdk';

@Injectable()
export class StellarService {
  constructor(private regionalHorizon: RegionalHorizonService) {}

  async submitTransaction(
    transactionEnvelope: string,
    region: DataResidencyRegion,
  ): Promise<any> {
    // Get regional Horizon endpoint
    const horizonUrl = await this.regionalHorizon.getHealthyHorizonUrl(region);

    // Submit transaction to regional endpoint
    const response = await fetch(`${horizonUrl}/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `tx=${transactionEnvelope}`,
    });

    return response.json();
  }
}
```

### 4. Request Examples

#### Check Regional Health

```bash
curl -X GET http://localhost:3000/api/v1/data-residency/health \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Response:
```json
{
  "database": {
    "EU": { "status": "healthy", "latency": 45 },
    "US": { "status": "healthy", "latency": 52 },
    "APAC": { "status": "healthy", "latency": 38 },
    "AFRICA": { "status": "healthy", "latency": 95 }
  },
  "horizon": {
    "EU": true,
    "US": true,
    "APAC": true,
    "AFRICA": true
  },
  "timestamp": "2026-02-25T10:30:00Z"
}
```

#### Access Patient Data (with Data Residency Enforcement)

```bash
curl -X GET http://localhost:3000/api/v1/patients/patient-123 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Tenant-ID: tenant-456"
```

Response Headers:
```
X-Data-Region: EU
X-Data-Processing-Location: Frankfurt, Germany
Cache-Control: private, no-cache, no-store, must-revalidate
```

### 5. Tenant Configuration

#### Update Tenant with Data Residency Settings

```bash
PATCH /api/v1/tenants/tenant-123
Content-Type: application/json
Authorization: Bearer YOUR_TOKEN

{
  "region": "EU",
  "strictDataResidency": true,
  "allowedIpRanges": [
    "10.0.0.0/8",
    "192.168.1.0/24",
    "203.0.113.0/24"
  ]
}
```

#### Bulk Assign Region

```bash
POST /api/v1/tenants/bulk-assign-region
Content-Type: application/json
Authorization: Bearer YOUR_TOKEN

{
  "tenantIds": [
    "tenant-1",
    "tenant-2",
    "tenant-3"
  ],
  "region": "EU",
  "strictDataResidency": false
}
```

## Testing

### Unit Tests

```bash
# Test data residency guard
npm test -- src/data-residency/guards/data-residency.guard.spec.ts

# Test regional services
npm test -- src/data-residency/services/
```

### Integration Tests

```bash
# Test full data residency flow
npm test -- src/data-residency/__tests__/data-residency.integration.spec.ts
```

### Load Test Regional Endpoints

```bash
cd load-tests
npm run load-test -- --scenario data-residency --region EU
npm run load-test -- --scenario data-residency --region US
```

## Troubleshooting

### Issue: Data Residency Guard Blocking Valid Requests

**Symptoms**: Getting `ForbiddenException: Client IP not permitted in this data residency region`

**Solution**:
1. Check tenant's `allowedIpRanges` configuration
2. Verify client IP format (should be valid IPv4)
3. Check CIDR notation is correct (e.g., `10.0.0.0/8`)
4. Disable strict mode temporarily for testing: `strictDataResidency: false`

```bash
# Check current IP ranges
SELECT id, region, allowed_ip_ranges, strict_data_residency 
FROM tenants 
WHERE id = 'tenant-123';

# Update IP ranges
UPDATE tenants 
SET allowed_ip_ranges = ARRAY['0.0.0.0/0'] 
WHERE id = 'tenant-123';
```

### Issue: Regional Database Connection Failures

**Symptoms**: `Error: ECONNREFUSED` when querying regional database

**Solution**:
1. Verify regional PostgreSQL instance is running
2. Check environment variables are correctly set
3. Verify network connectivity to regional database
4. Check database credentials are correct

```bash
# Test connection to EU database
psql -h postgres-eu.internal.example.com -U postgres -d healthy_stellar_eu -c "SELECT 1"

# Check data source health
curl http://localhost:3000/api/v1/data-residency/health
```

### Issue: IPFS Node Failures

**Symptoms**: Document storage fails for specific region

**Solution**:
1. Check IPFS node URLs in environment variables
2. Verify node accessibility: `curl https://ipfs-eu-1.infura.io:5001/api/v0/id`
3. Check network connectivity
4. Monitor IPFS node health via API

```bash
# Check regional IPFS node health
curl http://localhost:3000/api/v1/data-residency/ipfs-nodes
```

### Issue: Horizon Endpoint Timeouts

**Symptoms**: Transaction submissions hang

**Solution**:
1. Check Horizon URL configuration
2. Verify endpoint is accessible
3. Check for rate limiting
4. Monitor Horizon health endpoint

```bash
# Test Horizon endpoint
curl https://horizon.eu.stellar.org/health

# Check health status
curl http://localhost:3000/api/v1/data-residency/health
```

## Performance Optimization

### 1. Connection Pooling

Regional databases use connection pooling. Adjust pool size:

```typescript
const dataSourceOptions: DataSourceOptions = {
  ...baseOptions,
  poolSize: 10, // Increase for high concurrency
  maxQueryExecutionTime: 30000, // 30 seconds
};
```

### 2. Query Optimization

Use indexes on frequently queried regional fields:

```typescript
@Entity('patients')
export class PatientEntity {
  @Column()
  @Index()
  @Index(['tenantId', 'region'])
  tenantId: string;

  @Index()
  region: DataResidencyRegion;
}
```

### 3. Caching Strategy

Implement regional Redis caches for tenant config:

```typescript
@Injectable()
export class TenantCacheService {
  constructor(private cache: CacheService) {}

  async getTenant(tenantId: string): Promise<Tenant> {
    const cached = await this.cache.get(`tenant:${tenantId}`);
    if (cached) return cached;

    const tenant = await this.tenantService.findById(tenantId);
    await this.cache.set(`tenant:${tenantId}`, tenant, 3600); // 1 hour
    return tenant;
  }
}
```

### 4. Health Check Optimization

Implement health check caching to reduce overhead:

```typescript
@Injectable()
export class HealthCheckService {
  private lastCheck: Map<string, number> = new Map();
  private checkInterval = 30000; // 30 seconds

  async getRegionalHealth(region: DataResidencyRegion): Promise<Health> {
    const lastCheckTime = this.lastCheck.get(region) || 0;
    if (Date.now() - lastCheckTime < this.checkInterval) {
      return this.cachedHealth.get(region);
    }

    const health = await this.performHealthCheck(region);
    this.lastCheck.set(region, Date.now());
    return health;
  }
}
```

## Monitoring and Observability

### Prometheus Metrics

```typescript
@Injectable()
export class DataResidencyMetrics {
  private dataResidencyViolations = new Counter({
    name: 'healthy_stellar_data_residency_violations_total',
    help: 'Total data residency policy violations',
    labelNames: ['region', 'reason'],
  });

  recordViolation(region: string, reason: string) {
    this.dataResidencyViolations.labels(region, reason).inc();
  }
}
```

### Logging

Enable detailed logging for data residency:

```bash
# In .env
LOG_LEVEL=debug
LOG_DATA_RESIDENCY=true
```

### Distributed Tracing

Integration with OpenTelemetry:

```typescript
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('data-residency');

async function getPatient(patientId: string) {
  const span = tracer.startSpan('get-patient');
  try {
    // Get patient logic
    span.setAttributes({
      'patient.id': patientId,
      'data.region': tenant.region,
    });
  } finally {
    span.end();
  }
}
```

## Migration Checklist

- [ ] All prerequisites installed and configured
- [ ] Environment variables properly set
- [ ] Database migration applied (`npm run migration:run`)
- [ ] DataResidencyModule imported in AppModule
- [ ] RegionalDatabaseService initialized on app startup
- [ ] DataResidencyGuard applied to protected controllers
- [ ] All regional database instances operational
- [ ] All regional IPFS nodes accessible
- [ ] All regional Horizon endpoints responding
- [ ] Compliance checklist reviewed and signed
- [ ] Tenant configuration updated with regions
- [ ] Response interceptor working (X-Data-Region header visible)
- [ ] Monitoring and alerts configured
- [ ] Documentation updated
- [ ] Team training completed

## Support and Questions

For issues or questions about data residency implementation:

1. Check this guide and the main documentation ([docs/data-residency.md](./docs/data-residency.md))
2. Review the compliance checklist ([COMPLIANCE_CHECKLIST.md](./COMPLIANCE_CHECKLIST.md))
3. Check the test files for usage examples
4. Contact the data residency implementation team

---

**Last Updated**: 2026-02-25  
**Version**: 1.0  
**Maintainer**: Engineering Team
