import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClinicalAlert, AlertType, AlertPriority, AlertStatus } from '../entities/clinical-alert.entity';
import { NotificationService } from './notification.service';

@Injectable()
export class ClinicalAlertService {
  private readonly logger = new Logger(ClinicalAlertService.name);

  constructor(
    @InjectRepository(ClinicalAlert)
    private clinicalAlertRepository: Repository<ClinicalAlert>,
    private notificationService: NotificationService,
  ) {}

  async createAlert(alertData: {
    alertType: AlertType;
    priority: AlertPriority;
    title: string;
    message: string;
    patientId?: string;
    department?: string;
    room?: string;
    equipmentId?: string;
    alertData?: Record<string, any>;
  }): Promise<ClinicalAlert> {
    const alert = this.clinicalAlertRepository.create({
      ...alertData,
      status: AlertStatus.ACTIVE,
      notificationChannels: this.getNotificationChannels(alertData.priority),
    });

    const savedAlert = await this.clinicalAlertRepository.save(alert);
    
    // Send notifications
    await this.notificationService.sendAlertNotification(savedAlert);
    
    this.logger.log(`Clinical alert created: ${savedAlert.id} - ${savedAlert.title}`);
    return savedAlert;
  }

  async createSystemAlert(title: string, message: string, priority: string): Promise<ClinicalAlert> {
    return this.createAlert({
      alertType: AlertType.EQUIPMENT_MALFUNCTION,
      priority: priority as AlertPriority,
      title,
      message,
      department: 'IT',
    });
  }

  async createCriticalVitalsAlert(patientId: string, vitals: Record<string, any>): Promise<ClinicalAlert> {
    return this.createAlert({
      alertType: AlertType.CRITICAL_VITALS,
      priority: AlertPriority.CRITICAL,
      title: 'Critical Vital Signs Detected',
      message: `Patient vital signs require immediate attention`,
      patientId,
      alertData: vitals,
    });
  }

  async createMedicationAlert(patientId: string, medication: string, room: string): Promise<ClinicalAlert> {
    return this.createAlert({
      alertType: AlertType.MEDICATION_DUE,
      priority: AlertPriority.HIGH,
      title: 'Medication Due',
      message: `${medication} is due for administration`,
      patientId,
      room,
    });
  }

  async createEquipmentAlert(equipmentId: string, issue: string, department: string): Promise<ClinicalAlert> {
    return this.createAlert({
      alertType: AlertType.EQUIPMENT_MALFUNCTION,
      priority: AlertPriority.HIGH,
      title: 'Equipment Malfunction',
      message: issue,
      equipmentId,
      department,
    });
  }

  async acknowledgeAlert(alertId: string, userId: string): Promise<ClinicalAlert> {
    const alert = await this.clinicalAlertRepository.findOne({ where: { id: alertId } });
    if (!alert) {
      throw new Error('Alert not found');
    }

    alert.status = AlertStatus.ACKNOWLEDGED;
    alert.acknowledgedBy = userId;
    alert.acknowledgedAt = new Date();

    const updatedAlert = await this.clinicalAlertRepository.save(alert);
    this.logger.log(`Alert acknowledged: ${alertId} by ${userId}`);
    
    return updatedAlert;
  }

  async resolveAlert(alertId: string, userId: string, resolutionNotes?: string): Promise<ClinicalAlert> {
    const alert = await this.clinicalAlertRepository.findOne({ where: { id: alertId } });
    if (!alert) {
      throw new Error('Alert not found');
    }

    alert.status = AlertStatus.RESOLVED;
    alert.resolvedBy = userId;
    alert.resolvedAt = new Date();
    alert.resolutionNotes = resolutionNotes;

    const updatedAlert = await this.clinicalAlertRepository.save(alert);
    this.logger.log(`Alert resolved: ${alertId} by ${userId}`);
    
    return updatedAlert;
  }

  async getActiveAlerts(filters?: {
    department?: string;
    priority?: AlertPriority;
    alertType?: AlertType;
  }): Promise<ClinicalAlert[]> {
    const query = this.clinicalAlertRepository
      .createQueryBuilder('alert')
      .where('alert.status IN (:...statuses)', { 
        statuses: [AlertStatus.ACTIVE, AlertStatus.ACKNOWLEDGED] 
      })
      .orderBy('alert.priority', 'DESC')
      .addOrderBy('alert.createdAt', 'ASC');

    if (filters?.department) {
      query.andWhere('alert.department = :department', { department: filters.department });
    }

    if (filters?.priority) {
      query.andWhere('alert.priority = :priority', { priority: filters.priority });
    }

    if (filters?.alertType) {
      query.andWhere('alert.alertType = :alertType', { alertType: filters.alertType });
    }

    return query.getMany();
  }

  async getAlertMetrics(timeRange: { start: Date; end: Date }): Promise<any> {
    const alerts = await this.clinicalAlertRepository
      .createQueryBuilder('alert')
      .where('alert.createdAt BETWEEN :start AND :end', timeRange)
      .getMany();

    const metrics = {
      total: alerts.length,
      byType: {},
      byPriority: {},
      byStatus: {},
      averageResolutionTime: 0,
      activeAlerts: 0,
    };

    let totalResolutionTime = 0;
    let resolvedCount = 0;

    alerts.forEach(alert => {
      // Count by type
      metrics.byType[alert.alertType] = (metrics.byType[alert.alertType] || 0) + 1;
      
      // Count by priority
      metrics.byPriority[alert.priority] = (metrics.byPriority[alert.priority] || 0) + 1;
      
      // Count by status
      metrics.byStatus[alert.status] = (metrics.byStatus[alert.status] || 0) + 1;

      // Calculate resolution time
      if (alert.status === AlertStatus.RESOLVED && alert.resolvedAt) {
        const resolutionTime = alert.resolvedAt.getTime() - alert.createdAt.getTime();
        totalResolutionTime += resolutionTime;
        resolvedCount++;
      }

      // Count active alerts
      if (alert.status === AlertStatus.ACTIVE) {
        metrics.activeAlerts++;
      }
    });

    if (resolvedCount > 0) {
      metrics.averageResolutionTime = totalResolutionTime / resolvedCount / (1000 * 60); // in minutes
    }

    return metrics;
  }

  private getNotificationChannels(priority: AlertPriority): string[] {
    const channels = ['dashboard'];
    
    if (priority === AlertPriority.HIGH || priority === AlertPriority.CRITICAL) {
      channels.push('email', 'sms');
    }
    
    if (priority === AlertPriority.CRITICAL) {
      channels.push('pager', 'phone');
    }
    
    return channels;
  }
}