export const QUEUE_NAMES = {
  STELLAR_TRANSACTIONS: 'stellar-transactions',
  CONTRACT_WRITES: 'contract-writes',
  IPFS_UPLOADS: 'ipfs-uploads',
  EVENT_INDEXING: 'event-indexing',
  EMAIL_NOTIFICATIONS: 'email-notifications',
  FHIR_BULK_EXPORT: 'fhir-bulk-export',
  REPORTS: 'reports',
} as const;

export const JOB_TYPES = {
  ANCHOR_RECORD: 'anchorRecord',
  GRANT_ACCESS: 'grantAccess',
  REVOKE_ACCESS: 'revokeAccess',
  GENERATE_REPORT: 'generate-report',
  UPLOAD_TO_IPFS: 'uploadToIpfs',
  INDEX_CONTRACT_EVENT: 'indexContractEvent',
  VERIFY_ACCESS: 'verifyAccess',
} as const;

export const JOB_STATUS = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
} as const;
