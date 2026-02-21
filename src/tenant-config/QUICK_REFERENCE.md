# Tenant Configuration - Quick Reference

## 🚀 Quick Start

### 1. Get Configuration Value
```typescript
import { TenantConfigService } from './tenant-config/services/tenant-config.service';
import { SUPPORTED_CONFIG_KEYS } from './tenant-config/constants/config-keys.constant';

// Inject service
constructor(private readonly tenantConfigService: TenantConfigService) {}

// Get value
const value = await this.tenantConfigService.get<number>(
  tenantId,
  SUPPORTED_CONFIG_KEYS.MAX_RECORD_SIZE_MB
);
```

### 2. Protect Endpoint with Feature Flag
```typescript
import { RequireFeature } from './tenant-config/decorators/require-feature.decorator';
import { FeatureFlagGuard } from './tenant-config/guards/feature-flag.guard';
import { SUPPORTED_CONFIG_KEYS } from './tenant-config/constants/config-keys.constant';

@Controller('fhir')
@UseGuards(JwtAuthGuard, FeatureFlagGuard)
export class FhirController {
  @Get('export')
  @RequireFeature(SUPPORTED_CONFIG_KEYS.FHIR_EXPORT_ENABLED)
  async exportData() {
    // Only accessible if feature is enabled
  }
}
```

### 3. Check Feature Programmatically
```typescript
const isEnabled = await this.tenantConfigService.isFeatureEnabled(
  tenantId,
  SUPPORTED_CONFIG_KEYS.FHIR_EXPORT_ENABLED
);

if (!isEnabled) {
  throw new ForbiddenException('Feature not enabled');
}
```

## 📋 Configuration Keys

### Audit & Compliance
- `audit_retention_days` - Number (default: 2555)
- `medical_record_retention_days` - Number (default: 2555)
- `backup_retention_days` - Number (default: 90)

### Data Management
- `max_record_size_mb` - Number (default: 50)
- `allowed_record_types` - Array (default: ['medical_record', 'lab_result', ...])

### Feature Flags
- `emergency_access_enabled` - Boolean (default: true)
- `fhir_export_enabled` - Boolean (default: true)
- `mfa_required` - Boolean (default: false)
- `telemedicine_enabled` - Boolean (default: true)
- `prescription_management_enabled` - Boolean (default: true)
- `lab_integration_enabled` - Boolean (default: true)
- `imaging_integration_enabled` - Boolean (default: true)
- `billing_integration_enabled` - Boolean (default: true)
- `hl7_integration_enabled` - Boolean (default: false)
- `dicom_integration_enabled` - Boolean (default: false)

### Security Settings
- `session_timeout_minutes` - Number (default: 15)
- `password_expiration_days` - Number (default: 90)
- `max_login_attempts` - Number (default: 5)

## 🔌 API Endpoints

### Get All Configurations
```http
GET /admin/tenants/:id/config
Authorization: Bearer <admin_token>
```

### Get Specific Configuration
```http
GET /admin/tenants/:id/config/:key
Authorization: Bearer <admin_token>
```

### Update Configuration
```http
PATCH /admin/tenants/:id/config
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "key": "audit_retention_days",
  "value": "365",
  "valueType": "number"
}
```

### Bulk Update
```http
PATCH /admin/tenants/:id/config/bulk
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "configs": [
    { "key": "audit_retention_days", "value": "365", "valueType": "number" },
    { "key": "fhir_export_enabled", "value": "false", "valueType": "boolean" }
  ]
}
```

### Delete Configuration
```http
DELETE /admin/tenants/:id/config/:key
Authorization: Bearer <admin_token>
```

### Check Feature Status
```http
GET /admin/tenants/:id/features/:featureKey
Authorization: Bearer <admin_token>
```

## 🎯 Common Patterns

### Pattern 1: Validate File Size
```typescript
async validateFileSize(tenantId: string, file: Express.Multer.File) {
  const maxSizeMB = await this.tenantConfigService.get<number>(
    tenantId,
    SUPPORTED_CONFIG_KEYS.MAX_RECORD_SIZE_MB
  );
  
  if (file.size > maxSizeMB * 1024 * 1024) {
    throw new BadRequestException(`File exceeds ${maxSizeMB}MB limit`);
  }
}
```

### Pattern 2: Check Multiple Features
```typescript
async getEnabledFeatures(tenantId: string) {
  return await this.tenantConfigService.getMultiple(tenantId, [
    SUPPORTED_CONFIG_KEYS.FHIR_EXPORT_ENABLED,
    SUPPORTED_CONFIG_KEYS.TELEMEDICINE_ENABLED,
    SUPPORTED_CONFIG_KEYS.LAB_INTEGRATION_ENABLED,
  ]);
}
```

### Pattern 3: Conditional Logic
```typescript
async processData(tenantId: string, data: any) {
  const mfaRequired = await this.tenantConfigService.isFeatureEnabled(
    tenantId,
    SUPPORTED_CONFIG_KEYS.MFA_REQUIRED
  );
  
  if (mfaRequired && !user.mfaVerified) {
    throw new UnauthorizedException('MFA verification required');
  }
  
  // Process data...
}
```

### Pattern 4: Session Management
```typescript
async createSession(tenantId: string, userId: string) {
  const timeoutMinutes = await this.tenantConfigService.get<number>(
    tenantId,
    SUPPORTED_CONFIG_KEYS.SESSION_TIMEOUT_MINUTES
  );
  
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + timeoutMinutes);
  
  return { sessionId: '...', expiresAt };
}
```

## 🔍 Resolution Order

Configuration values are resolved in this order:

1. **Tenant Override** - Specific to this tenant
2. **Global Default** - System-wide default in database
3. **Hardcoded Default** - Defined in code
4. **Environment Variable** - From .env file

## ⚡ Performance Tips

1. **Cache Aware**: Values are cached for 10 minutes
2. **Batch Reads**: Use `getMultiple()` for multiple configs
3. **Feature Checks**: Use guard decorator when possible
4. **Type Safety**: Always specify type parameter: `get<number>()`

## 🐛 Troubleshooting

### Config Not Taking Effect
- Wait up to 10 minutes for cache to expire
- Check tenant ID is correct
- Verify configuration key spelling

### Permission Denied
- Ensure user has ADMIN role
- Check JWT token is valid
- Verify authentication middleware

### Redis Errors
- Application continues to work (falls back to database)
- Check Redis connection in logs
- Verify Redis credentials

## 📚 More Information

- Full documentation: `src/tenant-config/README.md`
- Usage examples: `src/tenant-config/examples/usage-example.ts`
- Implementation details: `TENANT_CONFIG_IMPLEMENTATION.md`
- Test examples: `src/tenant-config/**/*.spec.ts`

## 🔐 Security Notes

- Only ADMIN users can modify configurations
- All changes are audit logged
- Sensitive configs are flagged
- No secrets should be stored in configs

## 🚀 Deployment

```bash
# 1. Run migration
npm run migration:run

# 2. Configure Redis
export REDIS_HOST=localhost
export REDIS_PORT=6379

# 3. Start application
npm run start:dev
```

## 💡 Pro Tips

1. Always use `SUPPORTED_CONFIG_KEYS` constants
2. Specify type parameter for type safety
3. Use feature guard for endpoint protection
4. Check feature flags early in request flow
5. Document custom configuration keys
6. Test with different tenant configurations
7. Monitor cache hit rates in production
8. Use bulk updates for multiple configs

## 📞 Need Help?

1. Check the README
2. Review usage examples
3. Look at test cases
4. Ask the team

---

**Remember**: Configuration changes are cached for 10 minutes and all modifications are audit logged for HIPAA compliance.
