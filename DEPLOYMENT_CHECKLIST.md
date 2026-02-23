# Records Module - Deployment Checklist

## ✅ Pre-Deployment Checklist

### 1. Dependencies Installation
- [ ] Run `npm install` to install new dependencies
  - `@stellar/stellar-sdk`
  - `ipfs-http-client`
- [ ] Verify all dependencies are installed without errors
- [ ] Check for any peer dependency warnings

### 2. Environment Configuration
- [ ] Copy `.env.example` to `.env`
- [ ] Configure IPFS settings:
  - [ ] `IPFS_HOST` (default: localhost)
  - [ ] `IPFS_PORT` (default: 5001)
  - [ ] `IPFS_PROTOCOL` (default: http)
- [ ] Configure Stellar settings:
  - [ ] `STELLAR_NETWORK` (testnet or public)
  - [ ] `STELLAR_SECRET_KEY` (your Stellar account secret)
  - [ ] `STELLAR_CONTRACT_ID` (deployed Soroban contract ID)

### 3. IPFS Setup
- [ ] Install IPFS node (Docker or local)
- [ ] Start IPFS daemon
- [ ] Verify IPFS is accessible: `curl http://localhost:5001/api/v0/version`
- [ ] Configure IPFS CORS if needed
- [ ] Set up IPFS pinning service (optional, for production)

### 4. Stellar Setup
- [ ] Create Stellar testnet account
- [ ] Fund account with testnet lumens
- [ ] Deploy Soroban contract (see SOROBAN_CONTRACT_EXAMPLE.md)
- [ ] Save contract ID to `.env`
- [ ] Test contract invocation

### 5. Database Setup
- [ ] Ensure PostgreSQL is running
- [ ] Run migrations: `npm run migration:run`
- [ ] Verify `records` table was created
- [ ] Check indexes are in place:
  - [ ] `IDX_RECORDS_PATIENT_ID`
  - [ ] `IDX_RECORDS_CID`

### 6. Code Integration
- [ ] Verify `RecordsModule` is imported in `app.module.ts`
- [ ] Check all imports are correct
- [ ] Ensure no TypeScript compilation errors: `npm run build`

### 7. Testing
- [ ] Run unit tests: `npm run test`
- [ ] Run integration tests: `npm run test:e2e`
- [ ] Test endpoint manually with curl or Postman
- [ ] Verify file size limit (10MB) is enforced
- [ ] Test error scenarios:
  - [ ] Missing file
  - [ ] File too large
  - [ ] Invalid DTO
  - [ ] IPFS connection failure
  - [ ] Stellar transaction failure

## 🚀 Deployment Steps

### Development Environment

1. **Start Services**
   ```bash
   # Start IPFS
   docker run -d --name ipfs_host -p 5001:5001 -p 8080:8080 ipfs/go-ipfs:latest
   
   # Start PostgreSQL (if not running)
   docker run -d --name postgres -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:12
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Run Migrations**
   ```bash
   npm run migration:run
   ```

5. **Start Application**
   ```bash
   npm run start:dev
   ```

6. **Verify Deployment**
   ```bash
   curl http://localhost:3000/health
   ```

### Production Environment

1. **Pre-Production Checks**
   - [ ] All tests passing
   - [ ] Environment variables configured
   - [ ] Database migrations tested
   - [ ] IPFS pinning service configured
   - [ ] Stellar mainnet account funded
   - [ ] SSL/TLS certificates installed

2. **Build Application**
   ```bash
   npm run build
   ```

3. **Deploy to Server**
   ```bash
   # Copy dist folder to server
   scp -r dist/ user@server:/app/
   
   # Copy node_modules or run npm install on server
   ssh user@server "cd /app && npm install --production"
   ```

4. **Configure Production Services**
   - [ ] Set up NGINX reverse proxy
   - [ ] Configure PM2 or systemd for process management
   - [ ] Set up log rotation
   - [ ] Configure monitoring (e.g., Prometheus, Grafana)

5. **Start Production Server**
   ```bash
   npm run start:prod
   # or with PM2
   pm2 start dist/main.js --name healthy-stellar-backend
   ```

## 🔒 Security Checklist

### Application Security
- [ ] Enable HTTPS/TLS
- [ ] Configure CORS properly
- [ ] Implement rate limiting
- [ ] Add authentication guards to endpoints
- [ ] Enable audit logging
- [ ] Sanitize user inputs
- [ ] Validate file types and sizes

### Stellar Security
- [ ] Store secret keys in secure vault (e.g., AWS Secrets Manager)
- [ ] Never commit secret keys to version control
- [ ] Use environment variables for sensitive data
- [ ] Implement transaction signing on secure server
- [ ] Monitor Stellar account for unauthorized transactions

### IPFS Security
- [ ] Configure IPFS access control
- [ ] Use private IPFS network for sensitive data (optional)
- [ ] Implement IPFS pinning service for data persistence
- [ ] Monitor IPFS storage usage
- [ ] Set up IPFS garbage collection

### Database Security
- [ ] Enable SSL for database connections
- [ ] Use strong database passwords
- [ ] Implement database backups
- [ ] Enable audit logging
- [ ] Restrict database access by IP

## 📊 Monitoring Checklist

### Application Monitoring
- [ ] Set up health check endpoint monitoring
- [ ] Monitor API response times
- [ ] Track error rates
- [ ] Monitor memory and CPU usage
- [ ] Set up alerts for critical errors

### IPFS Monitoring
- [ ] Monitor IPFS node status
- [ ] Track storage usage
- [ ] Monitor upload success rate
- [ ] Set up alerts for IPFS failures

### Stellar Monitoring
- [ ] Monitor Stellar account balance
- [ ] Track transaction success rate
- [ ] Monitor transaction fees
- [ ] Set up alerts for failed transactions
- [ ] Monitor contract invocations

### Database Monitoring
- [ ] Monitor database connections
- [ ] Track query performance
- [ ] Monitor storage usage
- [ ] Set up backup verification
- [ ] Monitor replication lag (if using replicas)

## 🧪 Post-Deployment Verification

### Functional Tests
- [ ] Upload a test record
- [ ] Verify CID is returned
- [ ] Verify Stellar transaction hash is returned
- [ ] Check database entry was created
- [ ] Verify record is accessible on IPFS
- [ ] Verify transaction is on Stellar blockchain

### Performance Tests
- [ ] Test concurrent uploads
- [ ] Measure average response time
- [ ] Test with maximum file size (10MB)
- [ ] Monitor resource usage under load

### Error Handling Tests
- [ ] Test with invalid data
- [ ] Test with missing file
- [ ] Test with oversized file
- [ ] Verify error messages are appropriate
- [ ] Check error logging is working

## 📝 Documentation Checklist

- [ ] API documentation updated (Swagger)
- [ ] README.md updated with new endpoints
- [ ] Environment variables documented
- [ ] Deployment guide reviewed
- [ ] Architecture diagrams updated
- [ ] Security guidelines documented
- [ ] Troubleshooting guide created

## 🔄 Rollback Plan

### If Deployment Fails

1. **Revert Code**
   ```bash
   git revert <commit-hash>
   git push
   ```

2. **Revert Database**
   ```bash
   npm run migration:revert
   ```

3. **Restart Services**
   ```bash
   pm2 restart healthy-stellar-backend
   ```

4. **Verify Rollback**
   - [ ] Application is running
   - [ ] Database is consistent
   - [ ] No errors in logs

## 📞 Support Contacts

- **IPFS Issues**: https://discuss.ipfs.tech/
- **Stellar Issues**: https://discord.gg/stellardev
- **NestJS Issues**: https://discord.gg/nestjs
- **Database Issues**: [Your DBA contact]
- **DevOps Issues**: [Your DevOps contact]

## 🎯 Success Criteria

Deployment is successful when:
- [ ] All tests pass
- [ ] Application starts without errors
- [ ] Health check endpoint returns 200
- [ ] Test record upload succeeds
- [ ] CID is retrievable from IPFS
- [ ] Transaction is visible on Stellar
- [ ] Database entry is created correctly
- [ ] No critical errors in logs
- [ ] Monitoring dashboards show green status

## 📅 Maintenance Schedule

### Daily
- [ ] Check application logs
- [ ] Monitor error rates
- [ ] Verify IPFS node is running
- [ ] Check Stellar account balance

### Weekly
- [ ] Review performance metrics
- [ ] Check database size
- [ ] Verify backups are working
- [ ] Review security logs

### Monthly
- [ ] Update dependencies
- [ ] Review and optimize queries
- [ ] Audit access logs
- [ ] Test disaster recovery plan

---

**Last Updated**: [Date]
**Deployed By**: [Name]
**Environment**: [Development/Staging/Production]
# FHIR Bulk Export - Deployment Checklist

## Pre-Deployment

### Database
- [ ] Run migration: `npm run migration:run`
- [ ] Verify `bulk_export_jobs` table created
- [ ] Check indexes are in place
- [ ] Test database connection

### Dependencies
- [ ] Verify `@nestjs/bullmq` installed
- [ ] Verify `bullmq` installed
- [ ] Verify `@nestjs/schedule` installed
- [ ] Run `npm install` if needed

### Redis
- [ ] Redis server running
- [ ] Configure `REDIS_HOST` in `.env`
- [ ] Configure `REDIS_PORT` in `.env`
- [ ] Configure `REDIS_PASSWORD` in `.env` (if applicable)
- [ ] Test Redis connection

### Queue Configuration
- [ ] Verify `fhir-bulk-export` queue registered in `queue.module.ts`
- [ ] Check BullBoard accessible at `/admin/queues`
- [ ] Test queue connectivity

## Configuration

### Environment Variables
```env
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Optional: IPFS Configuration (for production)
IPFS_HOST=localhost
IPFS_PORT=5001
IPFS_PROTOCOL=http
```

### Module Registration
- [ ] `FhirModule` imported in `app.module.ts`
- [ ] `QueueModule` imported in `app.module.ts`
- [ ] `ScheduleModule` configured

## Testing

### Unit Tests
- [ ] Run: `npm run test -- bulk-export.service.spec`
- [ ] All tests passing
- [ ] Coverage acceptable

### E2E Tests
- [ ] Run: `npm run test:e2e -- fhir-bulk-export.e2e-spec`
- [ ] All scenarios passing
- [ ] Test with patient role
- [ ] Test with admin role

### Manual Testing
- [ ] Test export initiation
- [ ] Test status polling
- [ ] Test job cancellation
- [ ] Test access control (patient vs admin)
- [ ] Test expiration cleanup
- [ ] Verify NDJSON format
- [ ] Check IPFS URLs generated

## Production Setup

### IPFS Integration
- [ ] Choose IPFS solution:
  - [ ] Self-hosted IPFS node
  - [ ] Pinata service
  - [ ] Infura IPFS
  - [ ] Web3.Storage
- [ ] Install IPFS client library
- [ ] Update `uploadToIPFS()` method in `bulk-export.service.ts`
- [ ] Test file upload
- [ ] Test file retrieval
- [ ] Configure pinning strategy

### Monitoring
- [ ] Set up queue monitoring (BullBoard)
- [ ] Configure alerts for failed jobs
- [ ] Monitor Redis memory usage
- [ ] Track export job metrics
- [ ] Set up logging for exports

### Performance
- [ ] Configure Redis memory limits
- [ ] Set queue concurrency limits
- [ ] Test with large datasets
- [ ] Optimize streaming for memory
- [ ] Configure job timeouts

### Security
- [ ] Verify JWT authentication working
- [ ] Test role-based access control
- [ ] Validate patient data scoping
- [ ] Check IPFS file permissions
- [ ] Review error messages (no data leaks)

### Rate Limiting
- [ ] Configure export rate limits
- [ ] Set max concurrent exports per user
- [ ] Implement cooldown periods
- [ ] Add queue priority levels

## Post-Deployment

### Verification
- [ ] Test export from production
- [ ] Verify files accessible on IPFS
- [ ] Check cleanup job running
- [ ] Monitor queue health
- [ ] Review logs for errors

### Documentation
- [ ] Update API documentation
- [ ] Add examples to Swagger
- [ ] Document IPFS gateway URLs
- [ ] Create user guide
- [ ] Update changelog

### Monitoring Setup
- [ ] Dashboard for export metrics
- [ ] Alerts for:
  - [ ] Failed exports
  - [ ] Queue backlog
  - [ ] Redis connection issues
  - [ ] IPFS upload failures
  - [ ] Cleanup job failures

## Rollback Plan

### If Issues Occur
1. [ ] Disable export endpoints (feature flag)
2. [ ] Stop BullMQ workers
3. [ ] Revert database migration
4. [ ] Clear Redis queue
5. [ ] Restore previous version

### Rollback Commands
```bash
# Stop workers
pm2 stop bulk-export-worker

# Revert migration
npm run migration:revert

# Clear queue
redis-cli DEL bull:fhir-bulk-export:*

# Restart application
pm2 restart app
```

## Performance Benchmarks

### Target Metrics
- [ ] Export initiation: < 500ms
- [ ] Status check: < 200ms
- [ ] Processing: < 1 min per 1000 resources
- [ ] IPFS upload: < 5s per file
- [ ] Cleanup: < 30s per run

### Load Testing
- [ ] Test with 100 concurrent exports
- [ ] Test with 10,000+ resources
- [ ] Test with multiple resource types
- [ ] Verify memory usage stable
- [ ] Check Redis memory limits

## Compliance

### FHIR Specification
- [ ] Follows FHIR R4 standard
- [ ] Implements Bulk Data Access IG
- [ ] NDJSON format compliant
- [ ] Proper HTTP status codes
- [ ] OperationOutcome for errors

### Security & Privacy
- [ ] HIPAA compliance reviewed
- [ ] Patient data properly scoped
- [ ] Audit logging enabled
- [ ] Encryption in transit (HTTPS)
- [ ] Secure IPFS access

## Support

### Documentation Links
- Implementation: `FHIR_BULK_EXPORT_IMPLEMENTATION.md`
- Usage Guide: `src/fhir/BULK_EXPORT_GUIDE.md`
- Quick Reference: `src/fhir/QUICK_REFERENCE.md`
- API Docs: `src/fhir/README.md`

### Troubleshooting
- [ ] Document common issues
- [ ] Create runbook for operations
- [ ] Set up support channels
- [ ] Train support team

## Sign-Off

- [ ] Development complete
- [ ] Code reviewed
- [ ] Tests passing
- [ ] Documentation complete
- [ ] Security reviewed
- [ ] Performance validated
- [ ] Deployment approved

**Deployed By:** _______________  
**Date:** _______________  
**Version:** _______________
