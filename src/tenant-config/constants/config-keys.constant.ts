/**
 * Supported tenant configuration keys
 * These keys define the available configuration options for each tenant
 */
export const SUPPORTED_CONFIG_KEYS = {
  // Audit and Compliance
  AUDIT_RETENTION_DAYS: 'audit_retention_days',
  
  // Data Management
  MAX_RECORD_SIZE_MB: 'max_record_size_mb',
  ALLOWED_RECORD_TYPES: 'allowed_record_types',
  
  // Feature Flags
  EMERGENCY_ACCESS_ENABLED: 'emergency_access_enabled',
  FHIR_EXPORT_ENABLED: 'fhir_export_enabled',
  MFA_REQUIRED: 'mfa_required',
  TELEMEDICINE_ENABLED: 'telemedicine_enabled',
  PRESCRIPTION_MANAGEMENT_ENABLED: 'prescription_management_enabled',
  LAB_INTEGRATION_ENABLED: 'lab_integration_enabled',
  IMAGING_INTEGRATION_ENABLED: 'imaging_integration_enabled',
  BILLING_INTEGRATION_ENABLED: 'billing_integration_enabled',
  
  // Security Settings
  SESSION_TIMEOUT_MINUTES: 'session_timeout_minutes',
  PASSWORD_EXPIRATION_DAYS: 'password_expiration_days',
  MAX_LOGIN_ATTEMPTS: 'max_login_attempts',
  
  // Data Retention
  MEDICAL_RECORD_RETENTION_DAYS: 'medical_record_retention_days',
  BACKUP_RETENTION_DAYS: 'backup_retention_days',
  
  // Integration Settings
  HL7_INTEGRATION_ENABLED: 'hl7_integration_enabled',
  DICOM_INTEGRATION_ENABLED: 'dicom_integration_enabled',
} as const;

/**
 * Default configuration values
 * These are used as fallbacks when tenant-specific config is not set
 */
export const DEFAULT_CONFIG_VALUES: Record<string, any> = {
  [SUPPORTED_CONFIG_KEYS.AUDIT_RETENTION_DAYS]: 2555, // 7 years for HIPAA
  [SUPPORTED_CONFIG_KEYS.MAX_RECORD_SIZE_MB]: 50,
  [SUPPORTED_CONFIG_KEYS.EMERGENCY_ACCESS_ENABLED]: true,
  [SUPPORTED_CONFIG_KEYS.FHIR_EXPORT_ENABLED]: true,
  [SUPPORTED_CONFIG_KEYS.MFA_REQUIRED]: false,
  [SUPPORTED_CONFIG_KEYS.TELEMEDICINE_ENABLED]: true,
  [SUPPORTED_CONFIG_KEYS.PRESCRIPTION_MANAGEMENT_ENABLED]: true,
  [SUPPORTED_CONFIG_KEYS.LAB_INTEGRATION_ENABLED]: true,
  [SUPPORTED_CONFIG_KEYS.IMAGING_INTEGRATION_ENABLED]: true,
  [SUPPORTED_CONFIG_KEYS.BILLING_INTEGRATION_ENABLED]: true,
  [SUPPORTED_CONFIG_KEYS.SESSION_TIMEOUT_MINUTES]: 15,
  [SUPPORTED_CONFIG_KEYS.PASSWORD_EXPIRATION_DAYS]: 90,
  [SUPPORTED_CONFIG_KEYS.MAX_LOGIN_ATTEMPTS]: 5,
  [SUPPORTED_CONFIG_KEYS.MEDICAL_RECORD_RETENTION_DAYS]: 2555,
  [SUPPORTED_CONFIG_KEYS.BACKUP_RETENTION_DAYS]: 90,
  [SUPPORTED_CONFIG_KEYS.HL7_INTEGRATION_ENABLED]: false,
  [SUPPORTED_CONFIG_KEYS.DICOM_INTEGRATION_ENABLED]: false,
  [SUPPORTED_CONFIG_KEYS.ALLOWED_RECORD_TYPES]: [
    'medical_record',
    'lab_result',
    'prescription',
    'imaging',
    'consultation',
    'diagnosis',
    'treatment_plan',
  ],
};

/**
 * Global default tenant ID for system-wide defaults
 */
export const GLOBAL_TENANT_ID = '00000000-0000-0000-0000-000000000000';

/**
 * Redis cache configuration
 */
export const TENANT_CONFIG_CACHE_TTL = 600; // 10 minutes in seconds
export const TENANT_CONFIG_CACHE_PREFIX = 'tenant_config:';
