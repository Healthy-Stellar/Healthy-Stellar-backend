import { registerEnumType } from '@nestjs/graphql';

export enum UserRole {
  PATIENT = 'PATIENT',
  PROVIDER = 'PROVIDER',
  ADMIN = 'ADMIN',
}

export enum RecordType {
  LAB_RESULT = 'LAB_RESULT',
  PRESCRIPTION = 'PRESCRIPTION',
  IMAGING = 'IMAGING',
  CLINICAL_NOTE = 'CLINICAL_NOTE',
  VACCINATION = 'VACCINATION',
  DISCHARGE_SUMMARY = 'DISCHARGE_SUMMARY',
  OTHER = 'OTHER',
}

export enum GrantStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  REVOKED = 'REVOKED',
  EXPIRED = 'EXPIRED',
}

export enum JobStatus {
  QUEUED = 'QUEUED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum GdprRequestType {
  ACCESS = 'ACCESS',
  ERASURE = 'ERASURE',
  PORTABILITY = 'PORTABILITY',
  RECTIFICATION = 'RECTIFICATION',
}

export enum AuditAction {
  VIEW = 'VIEW',
  UPLOAD = 'UPLOAD',
  GRANT_ACCESS = 'GRANT_ACCESS',
  REVOKE_ACCESS = 'REVOKE_ACCESS',
  DOWNLOAD = 'DOWNLOAD',
  DELETE = 'DELETE',
}

registerEnumType(UserRole, { name: 'UserRole' });
registerEnumType(RecordType, { name: 'RecordType' });
registerEnumType(GrantStatus, { name: 'GrantStatus' });
registerEnumType(JobStatus, { name: 'JobStatus' });
registerEnumType(GdprRequestType, { name: 'GdprRequestType' });
registerEnumType(AuditAction, { name: 'AuditAction' });
