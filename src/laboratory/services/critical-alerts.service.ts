import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CriticalValueAlert,
  AlertStatus,
  NotificationMethod,
} from '../entities/critical-value-alert.entity';
import { LabResultValue } from '../entities/lab-result-value.entity';

@Injectable()
export class CriticalAlertsService {
  private readonly logger = new Logger(CriticalAlertsService.name);

  constructor(
    @InjectRepository(CriticalValueAlert)
    private alertRepository: Repository<CriticalValueAlert>,
    @InjectRepository(LabResultValue)
    private resultValueRepository: Repository<LabResultValue>,
  ) {}

  async create(data: {
    resultValueId: string;
    notifiedTo: string;
    notifiedToName?: string;
  }): Promise<CriticalValueAlert> {
    this.logger.log(`Creating critical value alert for result value: ${data.resultValueId}`);

    // Verify result value exists
    const resultValue = await this.resultValueRepository.findOne({
      where: { id: data.resultValueId },
      relations: ['labResult', 'labResult.orderItem', 'labResult.orderItem.labOrder', 'parameter'],
    });

    if (!resultValue) {
      throw new NotFoundException(`Result value with ID ${data.resultValueId} not found`);
    }

    const alert = this.alertRepository.create({
      resultValueId: data.resultValueId,
      notifiedTo: data.notifiedTo,
      notifiedToName: data.notifiedToName,
      status: AlertStatus.PENDING,
      notificationLog: [],
    });

    const saved = await this.alertRepository.save(alert);
    this.logger.log(`Critical value alert created: ${saved.id}`);

    return this.findOne(saved.id);
  }

  async findOne(id: string): Promise<CriticalValueAlert> {
    const alert = await this.alertRepository.findOne({
      where: { id },
      relations: [
        'resultValue',
        'resultValue.parameter',
        'resultValue.labResult',
        'resultValue.labResult.orderItem',
        'resultValue.labResult.orderItem.labOrder',
      ],
    });

    if (!alert) {
      throw new NotFoundException(`Critical value alert with ID ${id} not found`);
    }

    return alert;
  }

  async findPending(): Promise<CriticalValueAlert[]> {
    return this.alertRepository.find({
      where: { status: AlertStatus.PENDING },
      relations: [
        'resultValue',
        'resultValue.parameter',
        'resultValue.labResult',
        'resultValue.labResult.orderItem',
        'resultValue.labResult.orderItem.labOrder',
      ],
      order: { createdAt: 'ASC' },
    });
  }

  async findByProvider(providerId: string): Promise<CriticalValueAlert[]> {
    return this.alertRepository.find({
      where: { notifiedTo: providerId },
      relations: [
        'resultValue',
        'resultValue.parameter',
        'resultValue.labResult',
        'resultValue.labResult.orderItem',
        'resultValue.labResult.orderItem.labOrder',
      ],
      order: { createdAt: 'DESC' },
    });
  }

  async notify(
    id: string,
    method: NotificationMethod,
    userId: string,
    userName?: string,
    notes?: string,
  ): Promise<CriticalValueAlert> {
    const alert = await this.findOne(id);

    alert.status = AlertStatus.NOTIFIED;
    alert.notificationMethod = method;
    alert.notificationDate = new Date();
    alert.notifiedBy = userId;
    alert.notifiedByName = userName;
    alert.notificationAttempts += 1;

    // Add to notification log
    const logEntry = {
      timestamp: new Date(),
      method: method,
      status: 'SUCCESS',
      notes: notes,
    };

    alert.notificationLog = [...(alert.notificationLog || []), logEntry];
    alert.updatedBy = userId;

    const saved = await this.alertRepository.save(alert);
    this.logger.log(`Critical value alert notified: ${saved.id} via ${method}`);

    return this.findOne(saved.id);
  }

  async acknowledge(
    id: string,
    userId: string,
    userName?: string,
    notes?: string,
    followUpActions?: string,
  ): Promise<CriticalValueAlert> {
    const alert = await this.findOne(id);

    alert.status = AlertStatus.ACKNOWLEDGED;
    alert.acknowledgedBy = userId;
    alert.acknowledgedByName = userName;
    alert.acknowledgmentDate = new Date();
    alert.acknowledgmentNotes = notes;
    alert.followUpActions = followUpActions;
    alert.updatedBy = userId;

    const saved = await this.alertRepository.save(alert);
    this.logger.log(`Critical value alert acknowledged: ${saved.id}`);

    return this.findOne(saved.id);
  }

  async escalate(id: string, userId: string, notes?: string): Promise<CriticalValueAlert> {
    const alert = await this.findOne(id);

    alert.status = AlertStatus.ESCALATED;
    alert.updatedBy = userId;

    // Add to notification log
    const logEntry = {
      timestamp: new Date(),
      method: NotificationMethod.SYSTEM,
      status: 'ESCALATED',
      notes: notes || 'Alert escalated due to no acknowledgment',
    };

    alert.notificationLog = [...(alert.notificationLog || []), logEntry];

    const saved = await this.alertRepository.save(alert);
    this.logger.log(`Critical value alert escalated: ${saved.id}`);

    return this.findOne(saved.id);
  }

  async recordNotificationAttempt(
    id: string,
    method: NotificationMethod,
    success: boolean,
    notes?: string,
  ): Promise<CriticalValueAlert> {
    const alert = await this.findOne(id);

    alert.notificationAttempts += 1;

    const logEntry = {
      timestamp: new Date(),
      method: method,
      status: success ? 'SUCCESS' : 'FAILED',
      notes: notes,
    };

    alert.notificationLog = [...(alert.notificationLog || []), logEntry];

    const saved = await this.alertRepository.save(alert);
    this.logger.log(
      `Notification attempt recorded for alert ${saved.id}: ${success ? 'SUCCESS' : 'FAILED'}`,
    );

    return saved;
  }
}
