export enum CacheInvalidationEventType {
  TENANT_CONFIG_UPDATED = 'TENANT_CONFIG_UPDATED',
  TENANT_CONFIG_DELETED = 'TENANT_CONFIG_DELETED',
  FEATURE_FLAG_UPDATED = 'FEATURE_FLAG_UPDATED',
  FEATURE_FLAG_DELETED = 'FEATURE_FLAG_DELETED',
  RBAC_PERMISSION_UPDATED = 'RBAC_PERMISSION_UPDATED',
  RBAC_PERMISSION_DELETED = 'RBAC_PERMISSION_DELETED',
}

export interface CacheInvalidationEvent {
  type: CacheInvalidationEventType;
  tenantId: string;
  key: string;
  timestamp: number;
  source: string;
}
