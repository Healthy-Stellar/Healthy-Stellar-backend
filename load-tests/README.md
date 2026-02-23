# k6 Load Testing Suite

## Overview

Comprehensive load testing suite for the Healthy-Stellar backend API using k6. Tests critical endpoints under various load conditions to ensure system reliability and performance.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Test Scenarios](#test-scenarios)
4. [Running Tests](#running-tests)
5. [Test Types](#test-types)
6. [Performance Thresholds](#performance-thresholds)
7. [Baseline Management](#baseline-management)
8. [Results and Reporting](#results-and-reporting)
9. [InfluxDB and Grafana Integration](#influxdb-and-grafana-integration)
10. [Interpreting Results](#interpreting-results)
11. [Troubleshooting](#troubleshooting)

## Prerequisites

- **k6**: Load testing tool
  ```bash
  # Windows (using Chocolatey)
  choco install k6
  
  # macOS
  brew install k6
  
  # Linux
  sudo gpg -k
  sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
  echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
  sudo apt-get update
  sudo apt-get install k6
  ```

- **Node.js**: For baseline comparison scripts
- **Running API**: The backend API must be running
- **InfluxDB** (Optional): For metrics storage
- **Grafana** (Optional): For visualization

## Installation

```bash
# Clone repository
git clone <repository-url>
cd Healthy-Stellar-backend

# Install Node.js dependencies for scripts
npm install

# Verify k6 installation
k6 version
```

## Test Scenarios

### 1. Authentication Flow (`scenarios/auth-flow.js`)
- **Target**: 500 concurrent users
- **Operations**:
  - User registration
  - Challenge request
  - Authentication verification
  - Profile access
- **Threshold**: P95 < 300ms

### 2. Record Upload (`scenarios/record-upload.js`)
- **Target**: 100 concurrent uploads
- **Operations**:
  - Medical record upload with file (100KB)
  - Upload verification
- **Threshold**: P95 < 2000ms

### 3. Record Fetch (`scenarios/record-fetch.js`)
- **Target**: 1000 concurrent reads
- **Operations**:
  - Single record fetch
  - Paginated list fetch
  - Filtered record fetch
- **Threshold**: P95 < 200ms

### 4. Access Control (`scenarios/access-control.js`)
- **Target**: 200 concurrent operations
- **Operations**:
  - Access grant
  - Access verification
  - Access list
  - Access revoke
- **Threshold**: P95 < 400ms

## Running Tests

### Quick Start

```bash
# Set environment variables
export BASE_URL=http://localhost:3000
export ADMIN_EMAIL=admin@test.com
export ADMIN_PASSWORD=Admin123!@#
export DOCTOR_EMAIL=doctor@test.com
export DOCTOR_PASSWORD=Doctor123!@#

# Run smoke test (quick validation)
npm run load-test:smoke

# Run load test (expected production load)
npm run load-test:load

# Run stress test (find breaking points)
npm run load-test:stress

# Run soak test (extended duration)
npm run load-test:soak
```

### Individual Scenario Tests

```bash
# Test authentication flow only
k6 run load-tests/scenarios/auth-flow.js

# Test record upload only
k6 run load-tests/scenarios/record-upload.js

# Test record fetch only
k6 run load-tests/scenarios/record-fetch.js

# Test access control only
k6 run load-tests/scenarios/access-control.js
```

### Comprehensive Test Suite

```bash
# Run all scenarios with smoke test
TEST_TYPE=smoke k6 run load-tests/comprehensive-test.js

# Run all scenarios with load test
TEST_TYPE=load k6 run load-tests/comprehensive-test.js

# Run all scenarios with stress test
TEST_TYPE=stress k6 run load-tests/comprehensive-test.js

# Run all scenarios with soak test
TEST_TYPE=soak k6 run load-tests/comprehensive-test.js
```

## Test Types

### Smoke Test
- **Duration**: 1 minute
- **VUs**: 1-10
- **Purpose**: Verify functionality, quick sanity check
- **When**: Before every deployment, after code changes

### Load Test
- **Duration**: 11 minutes
- **VUs**: Ramps up to target load
  - Auth: 500 VUs
  - Upload: 100 VUs
  - Fetch: 1000 VUs
  - Access: 200 VUs
- **Purpose**: Test expected production load
- **When**: Before release, weekly performance checks

### Stress Test
- **Duration**: 26 minutes
- **VUs**: Ramps beyond normal load
  - Auth: Up to 1500 VUs
  - Upload: Up to 300 VUs
  - Fetch: Up to 3000 VUs
  - Access: Up to 600 VUs
- **Purpose**: Find breaking points, test system limits
- **When**: Before major releases, capacity planning

### Soak Test
- **Duration**: 3+ hours
- **VUs**: Sustained moderate load
  - Auth: 250 VUs
  - Upload: 50 VUs
  - Fetch: 500 VUs
  - Access: 100 VUs
- **Purpose**: Find memory leaks, stability issues
- **When**: Before major releases, after infrastructure changes

## Performance Thresholds

### Global Thresholds
- **P95 Response Time**: < 500ms
- **P99 Response Time**: < 1000ms
- **Error Rate**: < 1%

### Scenario-Specific Thresholds
- **Auth Flow**: P95 < 300ms
- **Record Upload**: P95 < 2000ms
- **Record Fetch**: P95 < 200ms
- **Access Control**: P95 < 400ms

### Threshold Configuration

Thresholds are defined in `config/config.js`:

```javascript
thresholds: {
  http_req_duration_p95: 500,
  http_req_duration_p99: 1000,
  http_req_failed_rate: 0.01,
  auth_duration_p95: 300,
  record_upload_duration_p95: 2000,
  record_fetch_duration_p95: 200,
  access_grant_duration_p95: 400,
}
```

## Baseline Management

### Creating Baseline

Run tests and save results as baseline:

```bash
# Run load test and create baseline
npm run load-test:baseline

# Or manually
TEST_TYPE=load k6 run load-tests/comprehensive-test.js
cp load-tests/results/comprehensive-load-latest.json load-tests/baselines/load-baseline.json
```

### Comparing with Baseline

```bash
# Run test and compare with baseline
npm run load-test:compare

# Or manually
TEST_TYPE=load k6 run load-tests/comprehensive-test.js
node load-tests/scripts/compare-baseline.js load comprehensive-load-latest.json
```

### Baseline Tolerance

- **Default**: 20% tolerance
- **Configurable**: Set `TOLERANCE` environment variable

```bash
# Use 10% tolerance
TOLERANCE=0.10 node load-tests/scripts/compare-baseline.js load comprehensive-load-latest.json
```

### Regression Detection

The comparison script will:
- ✅ Pass if metrics are within tolerance
- ⚠️ Warn if metrics exceed tolerance by 20-50%
- 🔴 Fail if metrics exceed tolerance by >50%

## Results and Reporting

### Result Files

Results are saved in `load-tests/results/`:

```
results/
├── auth-flow-summary.json
├── record-upload-summary.json
├── record-fetch-summary.json
├── access-control-summary.json
├── comprehensive-load-latest.json
├── comprehensive-load-2024-01-15T10-30-00.json
└── comparison-load-1705315800000.txt
```

### Result Structure

```json
{
  "metrics": {
    "http_reqs": { "values": { "count": 10000 } },
    "http_req_duration": {
      "values": {
        "avg": 150.5,
        "min": 50.2,
        "med": 140.3,
        "max": 500.8,
        "p(90)": 200.1,
        "p(95)": 250.3,
        "p(99)": 400.5
      }
    },
    "http_req_failed": { "values": { "rate": 0.005 } }
  }
}
```

### Reading Results

```bash
# View latest results
cat load-tests/results/comprehensive-load-latest.json | jq '.metrics.http_req_duration.values'

# View comparison report
cat load-tests/results/comparison-load-*.txt
```

## InfluxDB and Grafana Integration

### Setup InfluxDB

```bash
# Run InfluxDB with Docker
docker run -d \
  --name influxdb \
  -p 8086:8086 \
  -e INFLUXDB_DB=k6 \
  -e INFLUXDB_ADMIN_USER=admin \
  -e INFLUXDB_ADMIN_PASSWORD=admin123 \
  influxdb:1.8
```

### Configure k6 to Send Metrics

```bash
# Set InfluxDB URL
export INFLUXDB_URL=http://localhost:8086
export INFLUXDB_DB=k6
export INFLUXDB_TOKEN=your-token

# Run test with InfluxDB output
k6 run --out influxdb=http://localhost:8086/k6 load-tests/comprehensive-test.js
```

### Setup Grafana

```bash
# Run Grafana with Docker
docker run -d \
  --name grafana \
  -p 3001:3000 \
  grafana/grafana
```

### Configure Grafana Dashboard

1. Open Grafana: http://localhost:3001
2. Login (admin/admin)
3. Add InfluxDB data source:
   - URL: http://influxdb:8086
   - Database: k6
4. Import k6 dashboard:
   - Dashboard ID: 2587
   - Or use custom dashboard in `load-tests/grafana/`

### Grafana Dashboard Features

- Real-time metrics visualization
- Request rate over time
- Response time percentiles
- Error rate tracking
- VU (Virtual User) count
- Data transfer rates

## Interpreting Results

### Key Metrics

**Response Time Percentiles:**
- **P50 (Median)**: 50% of requests faster than this
- **P95**: 95% of requests faster than this (most important)
- **P99**: 99% of requests faster than this
- **Max**: Slowest request

**Error Rate:**
- **< 0.1%**: Excellent
- **0.1% - 1%**: Acceptable
- **> 1%**: Needs investigation

**Throughput:**
- **Requests/second**: System capacity
- **Data transfer**: Network utilization

### Good Performance Indicators

✅ P95 response time within thresholds
✅ Error rate < 1%
✅ Stable response times under load
✅ No memory leaks in soak tests
✅ Graceful degradation under stress

### Warning Signs

⚠️ P95 response time increasing over time
⚠️ Error rate > 1%
⚠️ High variance in response times
⚠️ Memory usage increasing in soak tests
⚠️ System crashes under stress

### Example Analysis

```
=== Load Test Results ===
Total Requests: 50,000
Success Rate: 99.5%
P95 Response Time: 245ms
P99 Response Time: 450ms

Analysis:
✅ Success rate excellent (99.5%)
✅ P95 within threshold (< 500ms)
✅ P99 within threshold (< 1000ms)
✅ System handles expected load well
```

## Troubleshooting

### Common Issues

**Issue: Connection refused**
```
Solution: Ensure API is running
$ npm run start:dev
```

**Issue: Authentication failures**
```
Solution: Create test users
$ npm run seed
```

**Issue: High error rate**
```
Solution: Check API logs, reduce load
$ docker logs healthy-stellar-backend
```

**Issue: Slow response times**
```
Solution: Check database performance, add indexes
$ npm run explain:queries
```

**Issue: Memory leaks in soak test**
```
Solution: Check for unclosed connections, memory profiling
$ node --inspect src/main.ts
```

### Debug Mode

```bash
# Run with verbose logging
k6 run --verbose load-tests/comprehensive-test.js

# Run with HTTP debug
k6 run --http-debug load-tests/comprehensive-test.js

# Run single VU for debugging
k6 run --vus 1 --duration 30s load-tests/scenarios/auth-flow.js
```

### Performance Optimization Tips

1. **Database**:
   - Add indexes on frequently queried fields
   - Optimize slow queries
   - Use connection pooling

2. **API**:
   - Enable caching
   - Optimize middleware
   - Use compression

3. **Infrastructure**:
   - Scale horizontally
   - Use load balancer
   - Optimize network

## CI/CD Integration

### GitHub Actions

Add to `.github/workflows/load-test.yml`:

```yaml
name: Load Tests

on:
  schedule:
    - cron: '0 2 * * *' # Daily at 2 AM
  workflow_dispatch:

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup k6
        run: |
          sudo gpg -k
          sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
          echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
          sudo apt-get update
          sudo apt-get install k6
      
      - name: Start API
        run: |
          docker-compose up -d
          sleep 30
      
      - name: Run Load Tests
        run: |
          TEST_TYPE=load k6 run load-tests/comprehensive-test.js
      
      - name: Compare with Baseline
        run: |
          node load-tests/scripts/compare-baseline.js load comprehensive-load-latest.json
      
      - name: Upload Results
        uses: actions/upload-artifact@v4
        with:
          name: load-test-results
          path: load-tests/results/
```

## Best Practices

1. **Start Small**: Begin with smoke tests, then scale up
2. **Baseline Early**: Create baseline before making changes
3. **Test Regularly**: Run load tests weekly or before releases
4. **Monitor Production**: Compare test results with production metrics
5. **Document Changes**: Note infrastructure or code changes that affect performance
6. **Iterate**: Continuously improve based on results

## Resources

- [k6 Documentation](https://k6.io/docs/)
- [k6 Examples](https://k6.io/docs/examples/)
- [Performance Testing Best Practices](https://k6.io/docs/testing-guides/test-types/)
- [Grafana k6 Dashboard](https://grafana.com/grafana/dashboards/2587)

## Support

For issues or questions:
1. Check this README
2. Review k6 documentation
3. Check API logs
4. Open an issue in the repository
