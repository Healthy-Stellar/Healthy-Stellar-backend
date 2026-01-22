export class MedicalAlertConfigDto {
  id: string;
  alertType: "critical" | "warning" | "info";
  name: string;
  condition: string;
  threshold: any;
  recipients: NotificationRecipientDto[];
  channels: ("email" | "sms" | "push" | "pager")[];
  priority: "low" | "medium" | "high" | "critical";
  autoEscalation: boolean;
  escalationTime: number;
  isActive: boolean;
}

export class NotificationRecipientDto {
  recipientType: "user" | "role" | "department";
  recipientId: string;
  notificationMethod: string[];
}

export class NotificationSettingsDto {
  id: string;
  departmentId: string;
  labResultNotifications: boolean;
  medicationAlerts: boolean;
  vitalSignAlerts: boolean;
  appointmentReminders: boolean;
  dischargeNotifications: boolean;
  customAlerts: MedicalAlertConfigDto[];
}
