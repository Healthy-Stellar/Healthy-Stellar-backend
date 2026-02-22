export enum NotificationEventType {
  RECORD_ACCESSED = 'record.accessed',
  ACCESS_GRANTED = 'access.granted',
  ACCESS_REVOKED = 'access.revoked',
  RECORD_UPLOADED = 'record.uploaded',
}

export interface NotificationEvent {
  eventType: NotificationEventType;
  actorId: string;
  resourceId: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}
