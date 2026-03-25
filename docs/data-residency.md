# Data Residency Controls for Multi-Region Deployments

## Overview

This document outlines the data residency controls implemented in Healthy-Stellar to ensure patient data compliance with regional regulations. Data residency refers to the physical or geographic location where data is stored, processed, and maintained.

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        Client Request                             │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  DataResidencyGuard (Region Validation)                  │    │
│  │  - Validates client IP against tenant allowlist         │    │
│  │  - Checks region consistency                             │    │
│  │  - Enforces strict/lenient modes                         │    │
│  └─────────────────────────────────────────────────────────┘    │
│                            ↓                                      │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  DataRegionHeaderInterceptor (Response Processing)       │    │
│  │  - Adds X-Data-Region header                             │    │
│  │  - Indicates processing location                          │    │
│  │  - Sets cache control directives                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                            ↓                                      │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  DataResidencyService (Region Configuration)             │    │
│  │  - Manages regional endpoints                             │    │
│  │  - Routes to correct infrastructure                       │    │
│  └─────────────────────────────────────────────────────────┘    │
│                            ↓                                      │
│  ┌──────────────┬──────────────────┬──────────────┬────────┐    │
│  │              │                   │               │        │    │
│  ▼              ▼                   ▼               ▼        ▼    │
│ ┌────┐    ┌──────────┐         ┌────────┐     ┌────────┐   │
│ │EU  │    │US/APAC   │         │AFRICA  │     │Regional│   │
│ │Data│    │Data      │         │Data    │     │Horizon │   │
│ │Base│    │Bases     │         │Base    │     │Nodes   │   │
│ └────┘    └──────────┘         └────────┘     └────────┘   │
│                                                               │
│ ┌──────────┬──────────────┬──────────────┬─────────────┐    │
│ │EU IPFS   │US IPFS       │APAC IPFS     │AFRICA IPFS  │    │
│ │Nodes     │Nodes         │Nodes         │Nodes        │    │
│ └──────────┴──────────────┴──────────────┴─────────────┘    │
│                                                               │
└──────────────────────────────────────────────────────────────────┘
```

## Supported Regions

### 1. **EU (Europe)**
- **Data Center**: Frankfurt, Germany
- **Primary Compliance**: GDPR
- **AWS Region**: eu-west-1
- **Stellar Horizon**: https://horizon.eu.stellar.org
- **IPFS Nodes**: EU-hosted infrastructure
- **Database**: PostgreSQL cluster in eu-west-1

### 2. **US (United States)**
- **Data Center**: N. Virginia, USA
- **Primary Compliance**: HIPAA, HITECH
- **AWS Region**: us-east-1
- **Stellar Horizon**: https://horizon.us.stellar.org
- **IPFS Nodes**: US-hosted infrastructure
- **Database**: PostgreSQL cluster in us-east-1

### 3. **APAC (Asia-Pacific)**
- **Data Center**: Singapore
- **Primary Compliance**: PDPA (Singapore), PIPL (China)
- **AWS Region**: ap-southeast-1
- **Stellar Horizon**: https://horizon.apac.stellar.org
- **IPFS Nodes**: APAC-hosted infrastructure
- **Database**: PostgreSQL cluster in ap-southeast-1

### 4. **AFRICA**
- **Data Center**: Cape Town, South Africa
- **Primary Compliance**: POPIA (Protection of Personal Information Act)
- **AWS Region**: af-south-1
- **Stellar Horizon**: https://horizon.africa.stellar.org
- **IPFS Nodes**: Africa-hosted infrastructure
- **Database**: PostgreSQL cluster in af-south-1

## Implementation Details

### TenantEntity Changes

```typescript
@Entity('tenants')
export class Tenant {
  // ... existing fields ...

  @Column({
    type: 'varchar',
    enum: DataResidencyRegion,
    default: DataResidencyRegion.EU,
  })
  region: DataResidencyRegion;

  @Column({
    type: 'boolean',
    default: false,
  })
  strictDataResidency: boolean;

  @Column({
    type: 'simple-array',
    nullable: true,
  })
  allowedIpRanges: string[];
}
```

### Data Residency Guard

Enforces data residency compliance at the request level:

```typescript
@Injectable()
export class DataResidencyGuard implements CanActivate {
  // Validates:
  // 1. Client IP against tenant allowlist (if configured)
  // 2. Region consistency in request headers
  // 3. Enforces strict mode if enabled on tenant
  // 4. Attaches region info to request context
}
```

**Features:**
- Blocks requests from disallowed IP ranges
- Validates X-Region-Hint headers
- Logs policy violations for audit trails
- Configurable enforcement (strict/lenient)

### Regional Configuration Service

Manages all regional infrastructure endpoints:

```typescript
@Injectable()
export class DataResidencyService {
  getRegionalConfig(region: DataResidencyRegion): RegionalConfig
  getHorizonUrl(region: DataResidencyRegion): string
  getIpfsNodes(region: DataResidencyRegion): string[]
  getDatabaseConfig(region: DataResidencyRegion): DatabaseConfig
  getAwsRegion(region: DataResidencyRegion): string
}
```

### Regional Database Routing

Routes database connections to region-specific PostgreSQL clusters:

```typescript
@Injectable()
export class RegionalDatabaseService {
  initializeRegionalDataSources(options: DataSourceOptions): Promise<void>
  getDataSource(region: DataResidencyRegion): DataSource
  getRepository(region: DataResidencyRegion, entityType: any): Repository
  getRegionalHealthStatus(): Promise<Record<Region, Health>>
}
```

**Benefits:**
- Data stays within designated regions
- Improves query latency for regional users
- Enables regional backups and recovery
- Supports regional compliance requirements

### Region-Aware IPFS Node Selection

Ensures IPFS storage uses region-specific nodes:

```typescript
@Injectable()
export class RegionalIpfsService {
  getIpfsNode(region: DataResidencyRegion): string
  getIpfsNodes(region: DataResidencyRegion): string[]
  checkNodeHealth(nodeUrl: string): Promise<boolean>
  rotateToHealthyNode(region: DataResidencyRegion): Promise<string>
}
```

**Features:**
- Automatic node selection with health checks
- Failover to backup nodes if primary fails
- Regional node isolation for IPFS storage
- Health monitoring and reporting

### Regional Stellar Horizon Configuration

Manages Stellar Horizon endpoints per region:

```typescript
@Injectable()
export class RegionalHorizonService {
  getHorizonUrl(region: DataResidencyRegion): string
  getAllHorizonEndpoints(): Record<Region, string>
  checkHorizonHealth(horizonUrl: string): Promise<boolean>
  getHealthyHorizonUrl(region: DataResidencyRegion): Promise<string>
}
```

**Features:**
- Region-specific Horizon endpoints
- Health monitoring for endpoints
- Network information caching
- Automatic failover support

### Response Header Integration

The `DataRegionHeaderInterceptor` adds region information to all responses:

```
X-Data-Region: EU
X-Data-Processing-Location: Frankfurt, Germany
Cache-Control: private, no-cache, no-store, must-revalidate
Pragma: no-cache
```

## Configuration

### Environment Variables

```bash
# EU Region
STELLAR_HORIZON_EU_URL=https://horizon.eu.stellar.org
IPFS_NODES_EU=https://ipfs-eu-1.infura.io:5001,https://ipfs-eu-2.infura.io:5001
DB_HOST_EU=postgres-eu.internal.example.com
DB_PORT_EU=5432
DB_NAME_EU=healthy_stellar_eu

# US Region
STELLAR_HORIZON_US_URL=https://horizon.us.stellar.org
IPFS_NODES_US=https://ipfs-us-1.infura.io:5001,https://ipfs-us-2.infura.io:5001
DB_HOST_US=postgres-us.internal.example.com
DB_PORT_US=5432
DB_NAME_US=healthy_stellar_us

# APAC Region
STELLAR_HORIZON_APAC_URL=https://horizon.apac.stellar.org
IPFS_NODES_APAC=https://ipfs-apac-1.infura.io:5001,https://ipfs-apac-2.infura.io:5001
DB_HOST_APAC=postgres-apac.internal.example.com
DB_PORT_APAC=5432
DB_NAME_APAC=healthy_stellar_apac

# AFRICA Region
STELLAR_HORIZON_AFRICA_URL=https://horizon.africa.stellar.org
IPFS_NODES_AFRICA=https://ipfs-africa-1.infura.io:5001,https://ipfs-africa-2.infura.io:5001
DB_HOST_AFRICA=postgres-africa.internal.example.com
DB_PORT_AFRICA=5432
DB_NAME_AFRICA=healthy_stellar_africa
```

## API Endpoints

### Check Regional Health

```bash
GET /api/v1/data-residency/health
```

Returns health status of all regional data centers:

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

### Get Current Region

```bash
GET /api/v1/data-residency/my-region
```

Returns the region where the current request is being processed:

```json
{
  "region": "EU",
  "dataCenter": "Frankfurt",
  "description": "EU Data Center (GDPR Compliant)",
  "horizonUrl": "https://horizon.eu.stellar.org",
  "awsRegion": "eu-west-1",
  "timestamp": "2026-02-25T10:30:00Z"
}
```

### Get Regional Configuration

```bash
GET /api/v1/data-residency/config
```

### Get IPFS Nodes

```bash
GET /api/v1/data-residency/ipfs-nodes
```

### Get Compliance Requirements

```bash
GET /api/v1/data-residency/compliance
```

## Integration with NestJS Application

### 1. Import DataResidencyModule

```typescript
import { DataResidencyModule } from './data-residency/data-residency.module';

@Module({
  imports: [
    DataResidencyModule,
    // ... other modules
  ],
})
export class AppModule {}
```

### 2. Use DataResidencyGuard

```typescript
import { DataResidencyGuard } from './data-residency/guards/data-residency.guard';

@Controller('api/v1/patients')
@UseGuards(DataResidencyGuard)
export class PatientController {
  // ... routes
}
```

### 3. Use Regional Services

```typescript
import { RegionalDatabaseService } from './data-residency/services/regional-database.service';

@Injectable()
export class PatientService {
  constructor(
    private regionalDb: RegionalDatabaseService,
  ) {}

  async getPatient(tenantId: string, patientId: string) {
    const tenant = await this.getTenant(tenantId);
    const patientRepo = this.regionalDb.getRepository(
      tenant.region,
      PatientEntity,
    );
    return patientRepo.findOne(patientId);
  }
}
```

### 4. Configure Regional Databases at Startup

```typescript
import { OnModuleInit } from '@nestjs/common';
import { RegionalDatabaseService } from './data-residency/services/regional-database.service';

@Injectable()
export class AppService implements OnModuleInit {
  constructor(
    private regionalDb: RegionalDatabaseService,
  ) {}

  async onModuleInit() {
    await this.regionalDb.initializeRegionalDataSources({
      type: 'postgres',
      synchronize: false,
      logging: true,
      entities: [/* your entities */],
      // ... other options
    });
  }
}
```

## Request Flow Example

### 1. Patient Data Access Request

```
Client (EU) → GET /api/v1/patients/123
  ↓
DataResidencyGuard
  - Extract client IP
  - Check tenant region requirement
  - Validate IP against allowlist
  - Attach region context to request
  ↓
DataResidencyService
  - Lookup regional configuration
  - Get EU-specific Horizon endpoint
  - Get EU IPFS nodes
  ↓
RegionalDatabaseService
  - Get EU PostgreSQL connection
  - Query patient from EU database
  ↓
DataRegionHeaderInterceptor
  - Add X-Data-Region: EU header
  - Set cache control headers
  ↓
Response with X-Data-Region: EU header
```

## Testing Data Residency

### Unit Tests

```bash
npm test -- data-residency.guard.spec.ts
npm test -- data-residency.service.spec.ts
npm test -- regional-database.service.spec.ts
npm test -- regional-ipfs.service.spec.ts
npm test -- regional-horizon.service.spec.ts
```

### Integration Tests

```bash
npm test -- data-residency.integration.spec.ts
```

### Load Testing

Verify regional routing under load:

```bash
npm run load-test:data-residency
```

## Monitoring and Alerts

### Metrics to Monitor

1. **Regional Database Latency**
   - Query response times per region
   - Connection pool utilization
   - Replication lag (for cross-region)

2. **IPFS Node Health**
   - Node availability per region
   - Success rate of IPFS operations
   - Storage duplication across regions

3. **Horizon Endpoint Health**
   - Transaction submission success rate
   - Horizon query latency
   - Network health by region

4. **Compliance Violations**
   - Blocked requests by region
   - IP range violation attempts
   - Region mismatch incidents

### Prometheus Metrics

```
healthy_stellar_data_residency_guard_blocks_total
healthy_stellar_regional_db_query_duration_seconds
healthy_stellar_ipfs_node_health{region="EU"}
healthy_stellar_horizon_endpoint_health{region="US"}
healthy_stellar_data_residency_violations_total
```

## Disaster Recovery

### Regional Database Failover

1. Monitor regional database health
2. Automatic failover to secondary cluster
3. Trigger replication sync
4. Alert operations team

### IPFS Node Failover

1. Health check detects node failure
2. Automatically route to healthy backup node
3. Queue affected operations for retry
4. Log incident for investigation

### Horizon Endpoint Failover

1. Health check detects endpoint unavailability
2. Route transaction submissions to secondary endpoint
3. Implement circuit breaker for failed endpoints
4. Automatic recovery attempts

## Compliance Checkpoints

See [COMPLIANCE_CHECKLIST.md](./COMPLIANCE_CHECKLIST.md) for regional compliance verification procedures.

## Security Considerations

### 1. Data Isolation

- Each region has isolated databases
- No cross-region data replication
- IP-based access controls
- Encryption at rest and in transit

### 2. Access Control

- Regional firewall rules
- VPC isolation per region
- Security group restrictions
- Certificate pinning for IPFS/Horizon

### 3. Audit Logging

- All region transitions logged
- IP violations recorded
- Regional access audit trails
- Compliance report generation

### 4. Network Security

- Regional VPN endpoints
- TLS 1.3 for all connections
- Certificate validation
- DDoS protection per region

## Performance Considerations

### Latency Optimization

1. **Regional DNS Resolution**
   - Route requests to nearest region
   - Use GeoDNS for automatic routing
   - Health-based failover

2. **Connection Pooling**
   - Per-region connection pools
   - Configurable pool sizes
   - Automatic cleanup of stale connections

3. **Caching Strategy**
   - Redis cache per region
   - Cross-region cache invalidation
   - Regional CDN for static assets

### Scalability

- Auto-scaling per region
- Regional load balancers
- Database read replicas within region
- Horizontal IPFS node scaling

## Future Enhancements

1. **Automatic Region Detection**
   - GeoIP-based routing
   - Client preference detection
   - Adaptive region switching

2. **Data Sovereignty Features**
   - Immutable audit logs per region
   - Regional key management
   - Cross-region data transfer controls

3. **Compliance Automation**
   - Automated compliance reporting
   - Policy enforcement
   - Breach notification automation

4. **Advanced Monitoring**
   - Machine learning-based anomaly detection
   - Predictive failover
   - Automated remediation

## References

- [GDPR Article 44-49: International Transfers](https://gdpr-info.eu/articles/transfers-processing/)
- [HIPAA Compliance Guide](https://www.hhs.gov/hipaa/index.html)
- [POPIA Data Residency Requirements](https://www.dataprotection.org.za/)
- [Stellar Horizon Documentation](https://developers.stellar.org/docs/run-core-node/administration)
- [IPFS Documentation](https://docs.ipfs.tech/)

## Support

For questions or issues related to data residency:

1. Check the application logs for DataResidencyGuard events
2. Monitor the `/api/v1/data-residency/health` endpoint
3. Review compliance checklist for your region
4. Contact the security team for policy clarifications
