// Module
export { HealthcareSecurityModule } from './healthcare-security.module';

// Services
export { EncryptionService } from './encryption/encryption.service';
export { AuditService } from './audit/audit.service';
export { IncidentService } from './incident/incident.service';
export { DeviceAuthService } from './device/device-auth.service';
export { RateLimitingService } from './rate-limiting/rate-limiting.service';

// Guards
export { HipaaAccessGuard, DeviceAuthGuard, HealthcareRateLimitGuard } from './guards/hipaa-access.guard';

// Decorators
export { HipaaRoles, MinimumNecessary, CorrelationId, CurrentUser, PhiAccess, BreakGlass } from './decorators/hipaa.decorators';

// Entities
export { AuditLog, AuditAction, AuditSeverity } from './entities/audit-log.entity';
export { SecurityIncident, IncidentType, IncidentSeverity, IncidentStatus } from './entities/security-incident.entity';
export { MedicalDevice, DeviceType, DeviceStatus, DeviceTrustLevel } from './entities/medical-device.entity';
export { BreachNotification, AccessPolicy } from './entities/breach-notification.entity';

// Types
export type { EncryptedData, EncryptionContext } from './encryption/encryption.service';
export type { AuditLogOptions, AuditQueryOptions } from './audit/audit.service';
export type { CreateIncidentDto } from './incident/incident.service';
export type { DeviceAuthChallenge, DeviceAuthResult, RegisterDeviceDto } from './device/device-auth.service';
export type { RateLimitConfig, RateLimitResult } from './rate-limiting/rate-limiting.service';
