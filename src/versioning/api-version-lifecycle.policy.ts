export type ApiVersionLifecycleStatus = 'current' | 'deprecated' | 'sunset';

export interface ApiVersionLifecyclePolicy {
  version: string;
  status: ApiVersionLifecycleStatus;
  releaseDate: string;
  baseUrl: string;
  changelog?: string;
  sunsetDate?: string;
  replacementVersion?: string;
}

export const API_VERSION_LIFECYCLE_POLICIES: ApiVersionLifecyclePolicy[] = [
  {
    version: '1',
    status: 'current',
    releaseDate: '2024-01-01',
    baseUrl: '/v1',
    changelog:
      'https://github.com/Healthy-Stellar/Healthy-Stellar-backend/blob/main/docs/api-versioning.md#v1',
  },
  {
    version: '2',
    status: 'deprecated',
    releaseDate: '2025-01-01',
    baseUrl: '/v2',
    sunsetDate: 'Wed, 01 Jan 2027 00:00:00 GMT',
    replacementVersion: '3',
    changelog:
      'https://github.com/Healthy-Stellar/Healthy-Stellar-backend/blob/main/docs/api-versioning.md#v2',
  },
];
