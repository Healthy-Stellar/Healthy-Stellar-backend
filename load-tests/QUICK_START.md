# k6 Load Testing - Quick Start Guide

## 5-Minute Setup

### Step 1: Install k6

**Windows:**
```bash
choco install k6
```

**macOS:**
```bash
brew install k6
```

**Linux:**
```bash
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

### Step 2: Start Your API

```bash
# Start the backend API
npm run start:dev

# Or with Docker
docker-compose up -d
```

### Step 3: Set Environment Variables

```bash
# Copy example env file
cp load-tests/.env.example load-tests/.env

# Edit with your values
export BASE_URL=http://localhost:3000
export ADMIN_EMAIL=admin@test.com
export ADMIN_PASSWORD=Admin123!@#
export DOCTOR_EMAIL=doctor@test.com
export DOCTOR_PASSWORD=Doctor123!@#
```

### Step 4: Run Your First Test

```bash
# Run a quick smoke test (1 minute)
npm run load-test:smoke
```

## Understanding the Output

```
✓ Auth: status is 200
✓ Auth: response has body
✓ Auth: response time < 5s

checks.........................: 100.00% ✓ 150      ✗ 0
data_received..................: 1.2 MB  20 kB/s
data_sent......................: 450 kB  7.5 kB/s
http_req_duration..............: avg=245ms min=50ms med=200ms max=500ms p(95)=400ms p(99)=480ms
http_req_failed................: 0.00%   ✓ 0        ✗ 150
http_reqs......................: 150     2.5/s
```

**Key Metrics:**
- ✅ **checks**: All tests passed (100%)
- 📊 **http_req_duration p(95)**: 95% of requests completed in 400ms
- ❌ **http_req_failed**: 0% error rate (excellent!)
- 🚀 **http_reqs**: 150 requests at 2.5 requests/second

## Next Steps

### Run Different Test Types

```bash
# Load test - expected production load (11 minutes)
npm run load-test:load

# Stress test - find breaking points (26 minutes)
npm run load-test:stress

# Soak test - extended duration (3+ hours)
npm run load-test:soak
```

### Test Individual Scenarios

```bash
# Test authentication only
npm run load-test:auth

# Test record upload only
npm run load-test:upload

# Test record fetch only
npm run load-test:fetch

# Test access control only
npm run load-test:access
```

### Create Performance Baseline

```bash
# Run load test and save as baseline
npm run load-test:baseline
```

### Compare with Baseline

```bash
# Run test and compare with baseline
npm run load-test:compare
```

## Common Scenarios

### Scenario 1: Pre-Deployment Check

```bash
# 1. Run smoke test to verify functionality
npm run load-test:smoke

# 2. Run load test to verify performance
npm run load-test:load

# 3. Compare with baseline
npm run load-test:compare
```

### Scenario 2: Performance Investigation

```bash
# 1. Run load test to establish current performance
npm run load-test:load

# 2. Make code changes

# 3. Run load test again
npm run load-test:load

# 4. Compare results
node load-tests/scripts/compare-baseline.js load comprehensive-load-latest.json
```

### Scenario 3: Capacity Planning

```bash
# 1. Run stress test to find limits
npm run load-test:stress

# 2. Review results to find breaking point
cat load-tests/results/comprehensive-stress-latest.json | jq '.metrics.http_req_duration.values'

# 3. Plan infrastructure scaling
```

## Troubleshooting

### API Not Responding

```bash
# Check if API is running
curl http://localhost:3000/health

# Start API if not running
npm run start:dev
```

### Authentication Failures

```bash
# Create test users
npm run seed

# Or manually create users via API
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"Admin123!@#","role":"ADMIN"}'
```

### High Error Rates

```bash
# Check API logs
docker logs healthy-stellar-backend

# Reduce load and try again
TEST_TYPE=smoke npm run load-test:smoke
```

## Tips for Success

1. **Start Small**: Always run smoke test first
2. **Monitor Resources**: Watch CPU, memory, database during tests
3. **Baseline Early**: Create baseline before making changes
4. **Test Regularly**: Run load tests weekly or before releases
5. **Document Results**: Keep notes on what changed between tests

## Getting Help

- 📖 Read full documentation: `load-tests/README.md`
- 🔍 Check k6 docs: https://k6.io/docs/
- 🐛 Report issues: Open GitHub issue
- 💬 Ask questions: Team Slack channel

## What's Next?

- [ ] Set up InfluxDB for metrics storage
- [ ] Configure Grafana for visualization
- [ ] Integrate with CI/CD pipeline
- [ ] Create custom test scenarios
- [ ] Set up alerting for performance regressions

Happy Load Testing! 🚀
