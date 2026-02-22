# Multi-Tenant Security Threat Model

## Overview
This document outlines the security threats and mitigations for the multi-tenant healthcare platform with schema-based isolation.

## Threat Categories

### 1. Cross-Tenant Data Leakage

**Threat**: Unauthorized access to another tenant's data through API endpoints or database queries.

**Attack Vectors**:
- Direct API access with manipulated tenant headers
- SQL injection to switch schemas
- Session hijacking across tenants
- Shared resource exploitation

**Mitigations**:
- ✅ TenantInterceptor validates tenant on every request
- ✅ TenantGuard enforces user-tenant association
- ✅ AsyncLocalStorage propagates tenant context
- ✅ PostgreSQL search_path isolation per connection
- ✅ Input validation on tenant identifiers
- ✅ Integration tests verify isolation

**Risk Level**: CRITICAL → MITIGATED

---

### 2. Schema Switching Attacks

**Threat**: Attacker attempts to switch PostgreSQL schema mid-request to access other tenant data.

**Attack Vectors**:
- SQL injection in tenant identifier
- Connection pool poisoning
- SET search_path manipulation

**Mitigations**:
- ✅ Tenant slug validation (alphanumeric + hyphens only)
- ✅ Parameterized queries for schema switching
- ✅ Connection-level schema isolation
- ✅ No user-controlled schema names in queries

**Risk Level**: HIGH → MITIGATED

---

### 3. Tenant Enumeration

**Threat**: Attacker discovers valid tenant identifiers through brute force or timing attacks.

**Attack Vectors**:
- Subdomain enumeration
- Header brute forcing
- Error message analysis

**Mitigations**:
- ✅ Generic error messages for invalid tenants
- ✅ Rate limiting on authentication endpoints
- ✅ Consistent response times
- ⚠️ Consider: Tenant allowlisting for sensitive deployments

**Risk Level**: MEDIUM → PARTIALLY MITIGATED

---

### 4. Privilege Escalation

**Threat**: User gains access to admin functions or other tenant's resources.

**Attack Vectors**:
- JWT token manipulation
- Role-based access control bypass
- Admin endpoint exposure

**Mitigations**:
- ✅ TenantGuard validates user-tenant association
- ✅ Separate admin endpoints (/admin/tenants)
- ✅ Role-based access control (RBAC)
- ✅ JWT includes tenantId claim

**Risk Level**: HIGH → MITIGATED

---

### 5. Resource Exhaustion

**Threat**: One tenant consumes excessive resources affecting other tenants.

**Attack Vectors**:
- Database connection pool exhaustion
- Storage quota violations
- CPU/memory abuse

**Mitigations**:
- ✅ Connection pool management
- ✅ Rate limiting per tenant
- ⚠️ TODO: Per-tenant resource quotas
- ⚠️ TODO: Query timeout enforcement

**Risk Level**: MEDIUM → PARTIALLY MITIGATED

---

### 6. Data Residency Violations

**Threat**: Tenant data stored in wrong schema or leaked during migrations.

**Attack Vectors**:
- Migration script errors
- Backup/restore mistakes
- Schema provisioning bugs

**Mitigations**:
- ✅ Automated schema provisioning
- ✅ Transaction-based migrations
- ✅ Schema naming convention (tenant_slug)
- ✅ Integration tests for isolation

**Risk Level**: HIGH → MITIGATED

---

## Security Controls Summary

### Implemented Controls

1. **Schema-Based Isolation**
   - Each tenant has dedicated PostgreSQL schema
   - search_path set per connection
   - No shared tables between tenants

2. **Request-Level Validation**
   - TenantInterceptor on all requests
   - Tenant extracted from subdomain or X-Tenant-ID header
   - Invalid tenant = 400 Bad Request

3. **Context Propagation**
   - AsyncLocalStorage for tenant context
   - No manual parameter passing required
   - Context available throughout async call stack

4. **Access Control**
   - TenantGuard validates user belongs to tenant
   - JWT contains tenantId claim
   - Cross-tenant access blocked at guard level

5. **Automated Testing**
   - Integration tests for cross-tenant access
   - Schema switching attack tests
   - Context propagation verification

### Recommended Additional Controls

1. **Audit Logging**
   - Log all cross-tenant access attempts
   - Track schema switches
   - Monitor for suspicious patterns

2. **Resource Quotas**
   - Per-tenant database size limits
   - Connection pool limits per tenant
   - API rate limits per tenant

3. **Encryption**
   - Encrypt sensitive data at rest
   - TLS for all connections
   - Separate encryption keys per tenant

4. **Monitoring**
   - Real-time alerts for isolation violations
   - Performance metrics per tenant
   - Anomaly detection

## Compliance Considerations

### HIPAA Requirements
- ✅ Data isolation between covered entities
- ✅ Audit trails for data access
- ✅ Access controls and authentication
- ⚠️ Encryption at rest (TODO)

### GDPR Requirements
- ✅ Data segregation by organization
- ✅ Right to erasure (tenant deletion)
- ✅ Data portability (schema export)
- ✅ Access logging

## Testing Strategy

### Unit Tests
- Tenant context propagation
- Schema name generation
- Validation logic

### Integration Tests
- Cross-tenant data access prevention
- Schema isolation verification
- Context propagation across modules

### Penetration Tests
- SQL injection attempts
- Schema switching attacks
- Privilege escalation
- Session hijacking

## Incident Response

### Data Leakage Detection
1. Monitor audit logs for cross-tenant queries
2. Alert on schema switching attempts
3. Automated rollback on isolation violations

### Response Procedures
1. Isolate affected tenant
2. Audit access logs
3. Notify affected parties
4. Remediate vulnerability
5. Post-incident review

## Conclusion

The multi-tenant architecture implements defense-in-depth with multiple layers of isolation:
- Database schema separation
- Request-level validation
- Context propagation
- Access control enforcement
- Comprehensive testing

**Overall Risk Assessment**: LOW (with implemented mitigations)

**Recommended Actions**:
1. Implement per-tenant resource quotas
2. Add encryption at rest
3. Deploy monitoring and alerting
4. Conduct regular penetration testing
5. Maintain audit logs for compliance
