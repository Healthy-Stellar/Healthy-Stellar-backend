import { SetMetadata } from '@nestjs/common';

export const AUDIT_LOG_METADATA_KEY = 'auditLogMetadata';

export interface AuditLogMetadata {
  operation: string;
  entityType: string;
}

/** Annotates an endpoint with the operation/entity name to use for audit logging. */
export const AuditLog = (operation: string, entityType: string) =>
  SetMetadata(AUDIT_LOG_METADATA_KEY, { operation, entityType } as AuditLogMetadata);
