# Branding IDOR Vulnerability - Bugfix Requirements

## Introduction

The application provides PUT and GET endpoints to manage white-label branding for tenants, but these endpoints lack tenant ownership validation. An admin of Tenant A can currently read and modify Tenant B's branding configuration (logo URL, colors, support email/phone, custom domain), enabling credential phishing attacks by redirecting support contacts to attacker-controlled channels. This is a critical Insecure Direct Object Reference (IDOR) vulnerability.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN an admin of Tenant A calls PUT /admin/tenants/[Tenant B ID]/branding THEN the system allows the update without verifying that the admin belongs to Tenant B, permitting cross-tenant branding modification

1.2 WHEN an admin of Tenant A calls GET /[Tenant B ID]/branding THEN the system returns Tenant B's branding without verifying that the requester belongs to Tenant B, permitting cross-tenant branding disclosure

1.3 WHEN a non-super-admin calls PUT or GET on another tenant's branding endpoint THEN the system does not apply the same tenant-ownership validation used by TenantConfigController, creating an IDOR gap

### Expected Behavior (Correct)

2.1 WHEN an admin of Tenant A calls PUT /admin/tenants/[Tenant B ID]/branding THEN the system SHALL deny the request with a 403 Forbidden error if the admin's tenant does not match Tenant B, unless the admin is a super admin

2.2 WHEN an admin of Tenant A calls GET /[Tenant B ID]/branding THEN the system SHALL deny the request with a 403 Forbidden error if the admin's tenant does not match Tenant B, unless the admin is a super admin

2.3 WHEN an admin calls PUT or GET on their own tenant's branding endpoint THEN the system SHALL allow the request and return or modify the branding configuration

2.4 WHEN a super admin calls PUT or GET on any tenant's branding endpoint THEN the system SHALL allow the request without tenant ownership restrictions

### Unchanged Behavior (Regression Prevention)

3.1 WHEN an admin calls PUT /admin/tenants/[own tenant ID]/branding with valid branding data THEN the system SHALL CONTINUE TO accept and persist the branding configuration (logo URL, colors, support email/phone, custom domain)

3.2 WHEN an admin calls GET /[own tenant ID]/branding THEN the system SHALL CONTINUE TO return the tenant's complete branding configuration

3.3 WHEN an unauthenticated or non-admin user calls PUT /admin/tenants/:id/branding THEN the system SHALL CONTINUE TO deny access with a 401 Unauthorized or 403 Forbidden error

3.4 WHEN an unauthenticated or non-admin user calls GET /:id/branding THEN the system SHALL CONTINUE TO deny access with a 401 Unauthorized or 403 Forbidden error
