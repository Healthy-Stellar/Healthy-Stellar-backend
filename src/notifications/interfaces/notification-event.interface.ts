export enum NotificationEventType {
  RECORD_ACCESSED = 'record.accessed',
  ACCESS_GRANTED = 'access.granted',
  ACCESS_REVOKED = 'access.revoked',
  RECORD_UPLOADED = 'record.uploaded',
  EMERGENCY_ACCESS = 'emergency-access',
  RECORD_AMENDED = 'record.amended',
  DIAGNOSIS_CREATED = 'diagnosis.created',
  DIAGNOSIS_SEVERITY_ESCALATED = 'diagnosis.severity_escalated',
  DIAGNOSIS_STATUS_CONFIRMED = 'diagnosis.status_confirmed',
}

export interface NotificationEvent {
  eventType: NotificationEventType;
  actorId: string;
  resourceId: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface NotificationPreferences {
  userId: string;
  preferredLanguage: string;
  emailEnabled?: boolean;
  pushEnabled?: boolean;
}

export interface LocalizedNotification {
  subject: string;
  body: string;
  lang: string;
}
