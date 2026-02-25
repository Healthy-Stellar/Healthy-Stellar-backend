/**
 * Data Models Index
 * Exports all data model interfaces from the SDK
 */

// Re-export from API files since they contain the models
export type {
  CreateRecordRequest,
  RecordResponse,
  ListRecordsResponse,
} from '../apis/records.api';

export type {
  GrantAccessRequest,
  AccessGrant,
  ListAccessGrantsResponse,
} from '../apis/access.api';

export type {
  LoginRequest,
  RegisterRequest,
  TokenResponse,
  UserInfo,
  RefreshTokenRequest,
} from '../apis/auth.api';
