// Module
export { HealthcareSecurityModule } from './healthcare-security.module';

// Services
export { EncryptionService } from './encryption.service';
export { AuditService } from './audit.service';
export { IncidentService } from './incident.service';
export { DeviceAuthService } from './device-auth.service';
export { RateLimitingService } from './rate-limiting.service';

// Guards
export {
  HipaaAccessGuard,
  DeviceAuthGuard,
  HealthcareRateLimitGuard,
} from './hipaa-access.guard';

// Decorators
export {
  HipaaRoles,
  MinimumNecessary,
  CorrelationId,
  CurrentUser,
  PhiAccess,
  BreakGlass,
} from './decorators/hipaa.decorators';

// Entities
export { AuditLog, AuditAction, AuditSeverity } from './entities/audit-log.entity';
export {
  SecurityIncident,
  IncidentType,
  IncidentSeverity,
  IncidentStatus,
} from './entities/security-incident.entity';
export {
  MedicalDevice,
  DeviceType,
  DeviceStatus,
  DeviceTrustLevel,
} from './entities/medical-device.entity';
export { BreachNotification, AccessPolicy } from './entities/breach-notification.entity';

// Types
export type { EncryptedData, EncryptionContext } from './encryption.service';
export type { AuditLogOptions, AuditQueryOptions } from './audit.service';
export type { CreateIncidentDto } from './incident.service';
export type {
  DeviceAuthChallenge,
  DeviceAuthResult,
  RegisterDeviceDto,
} from './device-auth.service';
export type { RateLimitConfig, RateLimitResult } from './rate-limiting.service';
