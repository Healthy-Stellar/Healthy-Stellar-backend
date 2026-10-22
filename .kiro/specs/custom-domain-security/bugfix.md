# Custom Domain Security Vulnerability - Bugfix Requirements

## Introduction

The documentation claims that requests with a Host header matching a tenant's custom domain are resolved to that tenant. However, this feature is incomplete and creates a security vulnerability. Three critical issues prevent custom domain routing from working securely:

1. No Host→tenant resolution middleware exists in the request pipeline
2. No unique constraint on the custom_domain column, allowing multiple tenants to claim the same domain
3. No DNS ownership verification, allowing a tenant to claim any domain (including domains they don't control, such as a hospital's domain)

These gaps create data exposure, denial-of-service, and domain hijacking risks.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a request includes a Host header matching a tenant's custom domain THEN the system does not resolve the request to that tenant and falls back to subdomain resolution

1.2 WHEN Tenant A sets custom_domain to "hospital.com" and Tenant B also sets custom_domain to "hospital.com" THEN the system does not prevent the duplicate claim and both tenants can own the same domain

1.3 WHEN a tenant claims custom_domain "hospital.com" THEN the system does not verify DNS ownership and accepts the claim without proof the tenant controls the domain

### Expected Behavior (Correct)

2.1 WHEN a request includes a Host header matching a tenant's custom domain THEN the system SHALL resolve the request to that tenant by querying a cached domain→tenant mapping

2.2 WHEN a tenant attempts to set custom_domain to a domain already claimed by another tenant THEN the system SHALL reject the request with a conflict error

2.3 WHEN a tenant claims a custom domain THEN the system SHALL require the tenant to verify DNS ownership via a TXT record before the domain becomes active

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a request includes an X-Tenant-ID header THEN the system SHALL CONTINUE TO resolve the request to that tenant without requiring Host header matching

3.2 WHEN a request includes a Host header with a valid subdomain THEN the system SHALL CONTINUE TO resolve the request to that tenant by extracting the subdomain

3.3 WHEN a request lacks both a valid X-Tenant-ID header and a valid subdomain THEN the system SHALL CONTINUE TO return a BadRequestException with "Tenant identifier not found"

3.4 WHEN a tenant status is "inactive" or a tenant does not exist THEN the system SHALL CONTINUE TO return a BadRequestException with "Invalid or inactive tenant"
