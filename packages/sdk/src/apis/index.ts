/**
 * API Classes Index
 * Exports all API classes from the SDK
 */

export { BaseApi, createAxiosInstance } from './base.api';
export {
  RecordsApi,
  type CreateRecordRequest,
  type RecordResponse,
  type ListRecordsResponse,
} from './records.api';
export {
  AccessApi,
  type GrantAccessRequest,
  type AccessGrant,
  type ListAccessGrantsResponse,
} from './access.api';
export {
  AuthApi,
  type LoginRequest,
  type RegisterRequest,
  type TokenResponse,
  type UserInfo,
  type RefreshTokenRequest,
} from './auth.api';
