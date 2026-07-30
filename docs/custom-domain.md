# Custom Domain Support

Each tenant can serve the patient portal and API under their own hostname (e.g. `portal.hospital.com`).

## How it works

1. The tenant admin sets `customDomain` via `PUT /admin/tenants/:id/branding`.
2. The backend records the domain in `tenant_branding.custom_domain`.
3. Incoming requests that carry a matching `Host` header are resolved to the correct tenant context.

> **TLS provisioning is out of scope** for this release. Tenants must arrange their own certificate (e.g. via Cloudflare, AWS ACM, or Let's Encrypt) and terminate TLS at their reverse proxy / CDN before traffic reaches this API.

---

## DNS / CNAME setup (tenant responsibility)

| Step | Action |
|------|--------|
| 1 | Log in to your DNS provider (Route 53, Cloudflare, GoDaddy, etc.). |
| 2 | Create a **CNAME** record pointing your subdomain to the platform's canonical hostname. |
| 3 | Wait for DNS propagation (TTL-dependent, typically 5 min – 48 h). |
| 4 | Verify with `dig CNAME portal.hospital.com` or `nslookup portal.hospital.com`. |

### Example DNS record

```
Type  : CNAME
Name  : portal.hospital.com
Value : api.healthystellar.io        ← platform canonical hostname
TTL   : 300
```

If you use **Cloudflare**, enable the orange-cloud proxy so Cloudflare handles TLS for you.  
If you use **AWS Route 53 + ACM**, create an ACM certificate for your subdomain and attach it to the ALB/CloudFront distribution that fronts this API.

---

## Validation rules

`customDomain` is validated server-side:

- Must be a valid RFC-1123 hostname (letters, digits, hyphens; no leading/trailing hyphens).
- Maximum 253 characters.
- Must **not** include a scheme (`https://`) or path.

Invalid examples that will be rejected:

```
https://portal.hospital.com   ← scheme not allowed
portal.hospital.com/app       ← path not allowed
-portal.hospital.com          ← leading hyphen
```

---

## Verifying the configuration

```bash
# 1. Set the custom domain via the admin API
curl -X PUT https://api.healthystellar.io/admin/tenants/<tenantId>/branding \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"customDomain": "portal.hospital.com"}'

# 2. Confirm DNS resolves correctly
dig CNAME portal.hospital.com +short
# Expected: api.healthystellar.io.

# 3. Test a request through the custom domain (after TLS is configured)
curl https://portal.hospital.com/health
```

---

## Future work (out of scope for this release)

- Automatic TLS certificate provisioning via ACME / Let's Encrypt.
- Domain ownership verification (DNS TXT record challenge).
- Wildcard subdomain routing (`*.healthystellar.io`).
