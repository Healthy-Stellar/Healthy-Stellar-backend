import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EquipmentStatus, EquipmentType, EquipmentHealthStatus } from '../entities/equipment-status.entity';
import { ClinicalAlertService } from './clinical-alert.service';

@Injectable()
export class EquipmentMonitoringService {
  private readonly logger = new Logger(EquipmentMonitoringService.name);

  constructor(
    @InjectRepository(EquipmentStatus)
    private equipmentRepository: Repository<EquipmentStatus>,
    private clinicalAlertService: ClinicalAlertService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async monitorEquipmentHealth(): Promise<void> {
    try {
      const equipment = await this.equipmentRepository.find({
        where: { isActive: true }
      });

      for (const device of equipment) {
        await this.checkEquipmentStatus(device);
      }
    } catch (error) {
      this.logger.error('Failed to monitor equipment health', error);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async checkMaintenanceSchedule(): Promise<void> {
    try {
      const today = new Date();
      const upcomingMaintenance = await this.equipmentRepository
        .createQueryBuilder('equipment')
        .where('equipment.nextMaintenanceDate <= :date', { 
          date: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
        })
        .andWhere('equipment.isActive = :active', { active: true })
        .getMany();

      for (const equipment of upcomingMaintenance) {
        await this.createMaintenanceAlert(equipment);
      }
    } catch (error) {
      this.logger.error('Failed to check maintenance schedule', error);
    }
  }

  private async checkEquipmentStatus(equipment: EquipmentStatus): Promise<void> {
    const healthData = await this.getEquipmentHealthData(equipment.equipmentId);
    
    let newStatus = equipment.status;
    const alerts = [];

    // Check battery level
    if (healthData.batteryLevel !== undefined) {
      equipment.batteryLevel = healthData.batteryLevel;
      if (healthData.batteryLevel < 10) {
        newStatus = EquipmentHealthStatus.CRITICAL;
        alerts.push('Critical battery level');
      } else if (healthData.batteryLevel < 25) {
        newStatus = EquipmentHealthStatus.WARNING;
        alerts.push('Low battery level');
      }
    }

    // Check connectivity
    if (!healthData.isConnected) {
      newStatus = EquipmentHealthStatus.OFFLINE;
      alerts.push('Equipment offline');
    }

    // Check performance metrics
    if (healthData.performanceIssues?.length > 0) {
      newStatus = EquipmentHealthStatus.WARNING;
      alerts.push(...healthData.performanceIssues);
    }

    // Check calibration status
    if (healthData.calibrationExpired) {
      newStatus = EquipmentHealthStatus.WARNING;
      alerts.push('Calibration expired');
    }

    // Update equipment status
    if (newStatus !== equipment.status || alerts.length > 0) {
      equipment.status = newStatus;
      equipment.alerts = alerts;
      equipment.performanceMetrics = healthData.metrics;
      equipment.operatingHours = healthData.operatingHours;
      
      await this.equipmentRepository.save(equipment);

      // Create alerts for critical issues
      if (newStatus === EquipmentHealthStatus.CRITICAL || newStatus === EquipmentHealthStatus.OFFLINE) {
        await this.clinicalAlertService.createEquipmentAlert(
          equipment.equipmentId,
          alerts.join(', '),
          equipment.department
        );
      }
    }
  }

  async registerEquipment(equipmentData: {
    equipmentId: string;
    equipmentName: string;
    equipmentType: EquipmentType;
    manufacturer: string;
    model: string;
    serialNumber: string;
    department: string;
    location: string;
  }): Promise<EquipmentStatus> {
    const equipment = this.equipmentRepository.create({
      ...equipmentData,
      status: EquipmentHealthStatus.OPERATIONAL,
      isActive: true,
    });

    return await this.equipmentRepository.save(equipment);
  }

  async updateEquipmentMaintenance(
    equipmentId: string, 
    maintenanceData: {
      lastMaintenanceDate: Date;
      nextMaintenanceDate: Date;
      maintenanceNotes?: string;
    }
  ): Promise<EquipmentStatus> {
    const equipment = await this.equipmentRepository.findOne({
      where: { equipmentId }
    });

    if (!equipment) {
      throw new Error('Equipment not found');
    }

    equipment.lastMaintenanceDate = maintenanceData.lastMaintenanceDate;
    equipment.nextMaintenanceDate = maintenanceData.nextMaintenanceDate;
    equipment.status = EquipmentHealthStatus.OPERATIONAL;
    equipment.alerts = [];

    return await this.equipmentRepository.save(equipment);
  }

  async getEquipmentByDepartment(department: string): Promise<EquipmentStatus[]> {
    return await this.equipmentRepository.find({
      where: { department, isActive: true },
      order: { equipmentName: 'ASC' }
    });
  }

  async getEquipmentMetrics(): Promise<any> {
    const equipment = await this.equipmentRepository.find({
      where: { isActive: true }
    });

    const metrics = {
      total: equipment.length,
      byStatus: {},
      byType: {},
      byDepartment: {},
      maintenanceDue: 0,
      criticalAlerts: 0,
    };

    const today = new Date();

    equipment.forEach(device => {
      // Count by status
      metrics.byStatus[device.status] = (metrics.byStatus[device.status] || 0) + 1;
      
      // Count by type
      metrics.byType[device.equipmentType] = (metrics.byType[device.equipmentType] || 0) + 1;
      
      // Count by department
      metrics.byDepartment[device.department] = (metrics.byDepartment[device.department] || 0) + 1;

      // Check maintenance due
      if (device.nextMaintenanceDate && device.nextMaintenanceDate <= today) {
        metrics.maintenanceDue++;
      }

      // Count critical alerts
      if (device.status === EquipmentHealthStatus.CRITICAL) {
        metrics.criticalAlerts++;
      }
    });

    return metrics;
  }

  private async createMaintenanceAlert(equipment: EquipmentStatus): Promise<void> {
    const daysUntilMaintenance = Math.ceil(
      (equipment.nextMaintenanceDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );

    let message: string;
    if (daysUntilMaintenance <= 0) {
      message = `Maintenance is overdue for ${equipment.equipmentName}`;
    } else {
      message = `Maintenance due in ${daysUntilMaintenance} days for ${equipment.equipmentName}`;
    }

    await this.clinicalAlertService.createEquipmentAlert(
      equipment.equipmentId,
      message,
      equipment.department
    );
  }

  // Mock implementation - replace with actual equipment monitoring
  private async getEquipmentHealthData(equipmentId: string): Promise<any> {
    return {
      batteryLevel: Math.random() * 100,
      isConnected: Math.random() > 0.1, // 90% uptime
      operatingHours: Math.random() * 1000,
      performanceIssues: Math.random() > 0.8 ? ['Performance degraded'] : [],
      calibrationExpired: Math.random() > 0.9,
      metrics: {
        temperature: 20 + Math.random() * 10,
        humidity: 40 + Math.random() * 20,
        vibration: Math.random() * 5,
      },
    };
  }
}