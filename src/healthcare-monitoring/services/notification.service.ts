import { Injectable, Logger, Optional } from '@nestjs/common';
import { ClinicalAlert } from '../entities/clinical-alert.entity';
import { HealthcareIncident } from '../entities/healthcare-incident.entity';
import { NotificationsService } from '../../notifications/services/notifications.service';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @Optional() private readonly notificationsService?: NotificationsService,
  ) {}

  async sendAlertNotification(alert: ClinicalAlert): Promise<void> {
    try {
      const channels = alert.notificationChannels || [];

      for (const channel of channels) {
        switch (channel) {
          case 'email':
            await this.sendEmailNotification(alert);
            break;
          case 'sms':
            await this.sendSmsNotification(alert);
            break;
          case 'pager':
            await this.sendPagerNotification(alert);
            break;
          case 'phone':
            await this.sendPhoneNotification(alert);
            break;
          case 'dashboard':
            await this.sendDashboardNotification(alert);
            break;
          default:
            this.logger.warn(`Unknown notification channel: ${channel}`);
        }
      }
    } catch (error) {
      this.logger.error('Failed to send alert notification', error);
    }
  }

  async sendIncidentNotification(incident: HealthcareIncident): Promise<void> {
    try {
      await this.sendEmailNotification({
        title: `Healthcare Incident Reported: ${incident.incidentNumber}`,
        message: `${incident.title}\n\nSeverity: ${incident.severity}\nDepartment: ${incident.department}\nDescription: ${incident.description}`,
        priority: incident.severity === 'catastrophic' ? 'critical' : 'high',
      } as any);

      if (incident.severity === 'catastrophic' || incident.severity === 'major') {
        await this.sendSmsNotification({
          title: `URGENT: Healthcare Incident ${incident.incidentNumber}`,
          message: `${incident.title} in ${incident.department}`,
          priority: 'critical',
        } as any);
      }

      this.logger.log(`Incident notification sent for: ${incident.incidentNumber}`);
    } catch (error) {
      this.logger.error('Failed to send incident notification', error);
    }
  }

  async sendRegulatoryNotification(incident: HealthcareIncident): Promise<void> {
    try {
      const regulatoryBodies = incident.regulatoryBodies || [];

      for (const body of regulatoryBodies) {
        await this.sendRegulatoryReport(incident, body);
      }

      this.logger.log(`Regulatory notifications sent for incident: ${incident.incidentNumber}`);
    } catch (error) {
      this.logger.error('Failed to send regulatory notification', error);
    }
  }

  async sendMaintenanceReminder(
    equipmentId: string,
    equipmentName: string,
    dueDate: Date,
  ): Promise<void> {
    try {
      await this.sendEmailNotification({
        title: 'Equipment Maintenance Due',
        message: `Maintenance is due for ${equipmentName} (ID: ${equipmentId}) on ${dueDate.toDateString()}`,
        priority: 'medium',
      } as any);

      this.logger.log(`Maintenance reminder sent for equipment: ${equipmentId}`);
    } catch (error) {
      this.logger.error('Failed to send maintenance reminder', error);
    }
  }

  async sendComplianceAlert(checkName: string, findings: string, severity: string): Promise<void> {
    try {
      await this.sendEmailNotification({
        title: `Compliance Issue Detected: ${checkName}`,
        message: `Compliance check failed: ${findings}`,
        priority: severity === 'critical' ? 'critical' : 'high',
      } as any);

      if (severity === 'critical') {
        await this.sendSmsNotification({
          title: 'CRITICAL Compliance Issue',
          message: `${checkName}: ${findings}`,
          priority: 'critical',
        } as any);
      }

      this.logger.log(`Compliance alert sent for: ${checkName}`);
    } catch (error) {
      this.logger.error('Failed to send compliance alert', error);
    }
  }

  private async sendEmailNotification(alert: ClinicalAlert): Promise<void> {
    const recipients = this.getRecipientsByPriority(alert.priority);
    const subject = `[${String(alert.priority).toUpperCase()}] ${alert.title}`;
    const body = this.formatEmailBody(alert);

    this.logger.log(`EMAIL: ${subject} → ${recipients.join(', ')}`);

    if (this.notificationsService) {
      await Promise.all(
        recipients.map((to) =>
          this.notificationsService!.sendEmail(to, subject, 'clinical-alert', {
            alert,
            body,
            recipients,
          }),
        ),
      );
    }
  }

  private async sendSmsNotification(alert: ClinicalAlert): Promise<void> {
    this.logger.log(`SMS: ${alert.title} — ${alert.message.substring(0, 100)}`);
  }

  private async sendPagerNotification(alert: ClinicalAlert): Promise<void> {
    this.logger.log(`PAGER: ${alert.title}`);
  }

  private async sendPhoneNotification(alert: ClinicalAlert): Promise<void> {
    this.logger.log(`PHONE: Calling for ${alert.title}`);
  }

  private async sendDashboardNotification(alert: ClinicalAlert): Promise<void> {
    this.logger.log(`DASHBOARD: ${alert.title} displayed`);
  }

  private async sendRegulatoryReport(
    incident: HealthcareIncident,
    regulatoryBody: string,
  ): Promise<void> {
    this.logger.log(
      `REGULATORY: Reporting incident ${incident.incidentNumber} to ${regulatoryBody}`,
    );
  }

  private formatEmailBody(alert: ClinicalAlert): string {
    return `
Alert Details:
- Type: ${alert.alertType}
- Priority: ${alert.priority}
- Department: ${alert.department || 'N/A'}
- Room: ${alert.room || 'N/A'}
- Patient ID: ${alert.patientId || 'N/A'}
- Equipment ID: ${alert.equipmentId || 'N/A'}

Description:
${alert.message}

Alert Data:
${alert.alertData ? JSON.stringify(alert.alertData, null, 2) : 'N/A'}

Timestamp: ${alert.createdAt}
Alert ID: ${alert.id}
    `.trim();
  }

  private getRecipientsByPriority(priority: string): string[] {
    const recipients = ['healthcare-alerts@hospital.com'];

    if (priority === 'high' || priority === 'critical') {
      recipients.push('charge-nurse@hospital.com', 'supervisor@hospital.com');
    }

    if (priority === 'critical') {
      recipients.push('medical-director@hospital.com');
    }

    return recipients;
  }
}
