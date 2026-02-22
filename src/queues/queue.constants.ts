export const QUEUE_NAMES = {
  STELLAR_TRANSACTIONS: 'stellar-transactions',
  IPFS_UPLOADS: 'ipfs-uploads',
  EMAIL_NOTIFICATIONS: 'email-notifications',
} as const;

export const JOB_TYPES = {
  ANCHOR_RECORD: 'anchorRecord',
  GRANT_ACCESS: 'grantAccess',
  REVOKE_ACCESS: 'revokeAccess',
} as const;

export const JOB_STATUS = {
  QUEUED: 'queued',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;
