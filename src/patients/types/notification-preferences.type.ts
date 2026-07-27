import { NotificationChannel } from '../dto/update-notification-preferences.dto';

export interface NotificationPreferences {
  newRecord: boolean;
  accessGranted: boolean;
  accessRevoked: boolean;
  appointmentReminder: boolean;
  channels: NotificationChannel[];
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  newRecord: true,
  accessGranted: true,
  accessRevoked: true,
  appointmentReminder: true,
  channels: [NotificationChannel.WEBSOCKET],
};
