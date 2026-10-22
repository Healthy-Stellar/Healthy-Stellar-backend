/**
 * Centralized error taxonomy for the Healthy-Stellar backend.
 *
 * Every error code that can appear in an API response `code` field is defined
 * here.  The GlobalExceptionFilter maps HTTP status codes and typed exceptions
 * to these codes so clients can branch on a stable string rather than on
 * human-readable messages.
 */
export enum AppErrorCode {
  // ── Generic HTTP ──────────────────────────────────────────────────────────
  BAD_REQUEST = 'BAD_REQUEST',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNPROCESSABLE_ENTITY = 'UNPROCESSABLE_ENTITY',
  TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  BAD_GATEWAY = 'BAD_GATEWAY',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',

  // ── Domain: Records ───────────────────────────────────────────────────────
  RECORD_NOT_FOUND = 'RECORD_NOT_FOUND',
  RECORD_ALREADY_EXISTS = 'RECORD_ALREADY_EXISTS',
  RECORD_ACCESS_DENIED = 'RECORD_ACCESS_DENIED',
  RECORD_UPLOAD_FAILED = 'RECORD_UPLOAD_FAILED',
  RECORD_VERSION_CONFLICT = 'RECORD_VERSION_CONFLICT',

  // ── Domain: Access Control ────────────────────────────────────────────────
  ACCESS_DENIED = 'ACCESS_DENIED',
  ACCESS_GRANT_NOT_FOUND = 'ACCESS_GRANT_NOT_FOUND',
  ACCESS_GRANT_EXPIRED = 'ACCESS_GRANT_EXPIRED',
  ACCESS_GRANT_REVOKED = 'ACCESS_GRANT_REVOKED',

  // ── Domain: Patients ─────────────────────────────────────────────────────
  PATIENT_NOT_FOUND = 'PATIENT_NOT_FOUND',
  PATIENT_DUPLICATE = 'PATIENT_DUPLICATE',

  // ── Domain: Providers / Users ─────────────────────────────────────────────
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  USER_ALREADY_EXISTS = 'USER_ALREADY_EXISTS',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  MFA_REQUIRED = 'MFA_REQUIRED',

  // ── Domain: Tenant ────────────────────────────────────────────────────────
  TENANT_NOT_FOUND = 'TENANT_NOT_FOUND',
  TENANT_SUSPENDED = 'TENANT_SUSPENDED',

  // ── Domain: Stellar / Blockchain ─────────────────────────────────────────
  STELLAR_TRANSACTION_ERROR = 'STELLAR_TRANSACTION_ERROR',
  STELLAR_CONTRACT_ERROR = 'STELLAR_CONTRACT_ERROR',
  STELLAR_NETWORK_ERROR = 'STELLAR_NETWORK_ERROR',

  // ── Domain: IPFS / Storage ────────────────────────────────────────────────
  IPFS_UPLOAD_ERROR = 'IPFS_UPLOAD_ERROR',
  IPFS_FETCH_ERROR = 'IPFS_FETCH_ERROR',
  STORAGE_QUOTA_EXCEEDED = 'STORAGE_QUOTA_EXCEEDED',

  // ── Domain: Encryption / Key Management ──────────────────────────────────
  ENCRYPTION_ERROR = 'ENCRYPTION_ERROR',
  KEY_NOT_FOUND = 'KEY_NOT_FOUND',
  KEY_ROTATION_FAILED = 'KEY_ROTATION_FAILED',

  // ── Domain: GraphQL / Subscriptions ──────────────────────────────────────
  SUBSCRIPTION_LIMIT_REACHED = 'SUBSCRIPTION_LIMIT_REACHED',
  SUBSCRIPTION_UNAUTHORIZED = 'SUBSCRIPTION_UNAUTHORIZED',
  SUBSCRIPTION_FORBIDDEN = 'SUBSCRIPTION_FORBIDDEN',

  // ── Domain: FHIR ─────────────────────────────────────────────────────────
  FHIR_MAPPING_ERROR = 'FHIR_MAPPING_ERROR',
  FHIR_VALIDATION_ERROR = 'FHIR_VALIDATION_ERROR',
}

/**
 * Maps an HTTP status code to the default AppErrorCode.
 * Used by GlobalExceptionFilter when no domain-specific code is available.
 */
export const HTTP_STATUS_TO_ERROR_CODE: Record<number, AppErrorCode> = {
  400: AppErrorCode.BAD_REQUEST,
  401: AppErrorCode.UNAUTHORIZED,
  403: AppErrorCode.FORBIDDEN,
  404: AppErrorCode.NOT_FOUND,
  409: AppErrorCode.CONFLICT,
  422: AppErrorCode.VALIDATION_ERROR,
  429: AppErrorCode.TOO_MANY_REQUESTS,
  500: AppErrorCode.INTERNAL_ERROR,
  502: AppErrorCode.BAD_GATEWAY,
  503: AppErrorCode.SERVICE_UNAVAILABLE,
};
