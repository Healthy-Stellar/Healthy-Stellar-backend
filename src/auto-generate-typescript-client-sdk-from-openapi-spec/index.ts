// ─── Client ──────────────────────────────────────────────────────────────────
export { MedChainClient } from './client';
export type { MedChainClientOptions } from './client';

// ─── API Classes ─────────────────────────────────────────────────────────────
export { AuthApi, RecordsApi, AccessApi, AuditApi } from './generated/api';
export type { ListRecordsParams, ListGrantsParams, ListAuditLogsParams } from './generated/api';

// ─── Models / Interfaces ─────────────────────────────────────────────────────
export type {
  // Auth
  LoginRequest,
  LoginResponse,
  RefreshRequest,
  // Records
  RecordType,
  RecordMetadata,
  MedicalRecord,
  PaginatedRecords,
  // Access
  Permission,
  AccessGrant,
  GrantAccessRequest,
  PaginatedAccessGrants,
  // Audit
  AuditLog,
  PaginatedAuditLogs,
  // Errors
  ErrorResponse,
} from './generated/models';

// ─── Configuration ────────────────────────────────────────────────────────────
export type { Configuration } from './generated/base';
