import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CreateDisasterIncidentDto,
  CreateEmergencyChartNoteDto,
  CreateMonitoringRecordDto,
  CreateRapidResponseDto,
  CreateResourceDto,
  CreateTriageCaseDto,
  UpdateDisasterIncidentStatusDto,
  UpdateRapidResponseStatusDto,
  UpdateResourceAllocationDto,
  UpdateTriagePriorityDto,
} from '../dto/emergency-operations.dto';
import { EmergencyTriageCase, TriageQueueStatus } from '../entities/emergency-triage.entity';
import {
  CriticalCareAlert,
  CriticalCareMonitoring,
  CriticalAlertSeverity,
} from '../entities/critical-care-monitoring.entity';
import {
  EmergencyResource,
  EmergencyResourceStatus,
} from '../entities/emergency-resource.entity';
import {
  RapidResponseEvent,
  RapidResponseStatus,
} from '../entities/rapid-response-event.entity';
import {
  DisasterIncident,
  DisasterIncidentStatus,
  EmergencyChartNote,
} from '../entities/emergency-documentation.entity';

@Injectable()
export class EmergencyOperationsService {
  constructor(
    @InjectRepository(EmergencyTriageCase)
    private triageRepository: Repository<EmergencyTriageCase>,
    @InjectRepository(CriticalCareMonitoring)
    private monitoringRepository: Repository<CriticalCareMonitoring>,
    @InjectRepository(CriticalCareAlert)
    private alertRepository: Repository<CriticalCareAlert>,
    @InjectRepository(EmergencyResource)
    private resourceRepository: Repository<EmergencyResource>,
    @InjectRepository(RapidResponseEvent)
    private rapidResponseRepository: Repository<RapidResponseEvent>,
    @InjectRepository(EmergencyChartNote)
    private chartNoteRepository: Repository<EmergencyChartNote>,
    @InjectRepository(DisasterIncident)
    private disasterRepository: Repository<DisasterIncident>,
  ) {}

  async createTriageCase(dto: CreateTriageCaseDto): Promise<EmergencyTriageCase> {
    const triageCase = this.triageRepository.create({
      ...dto,
      triagedAt: new Date(),
    });
    return await this.triageRepository.save(triageCase);
  }

  async updateTriagePriority(
    id: string,
    dto: UpdateTriagePriorityDto,
  ): Promise<EmergencyTriageCase> {
    const triageCase = await this.findTriageCase(id);
    triageCase.acuityLevel = dto.acuityLevel;
    if (dto.queueStatus) triageCase.queueStatus = dto.queueStatus;
    return await this.triageRepository.save(triageCase);
  }

  async getTriageQueue(status?: TriageQueueStatus): Promise<EmergencyTriageCase[]> {
    return await this.triageRepository.find({
      where: status ? { queueStatus: status } : {},
      order: { acuityLevel: 'ASC', createdAt: 'ASC' },
    });
  }

  async recordCriticalMonitoring(dto: CreateMonitoringRecordDto): Promise<CriticalCareMonitoring> {
    const record = this.monitoringRepository.create({
      ...dto,
      recordedAt: dto.recordedAt ? new Date(dto.recordedAt) : new Date(),
    });

    // Simple baseline thresholding to support real-time alerting.
    const thresholdBreach = this.isThresholdBreach(dto.metricType, dto.value);
    record.thresholdBreach = thresholdBreach;
    const saved = await this.monitoringRepository.save(record);

    if (thresholdBreach) {
      await this.alertRepository.save(
        this.alertRepository.create({
          patientId: dto.patientId,
          alertType: dto.metricType,
          severity: this.estimateSeverity(dto.metricType, dto.value),
          message: `Critical monitoring threshold breach detected for ${dto.metricType}: ${dto.value}${dto.unit ? ` ${dto.unit}` : ''}`,
          metadata: { metricType: dto.metricType, value: dto.value, unit: dto.unit },
        }),
      );
    }

    return saved;
  }

  async getCriticalAlerts(
    patientId: string,
    includeAcknowledged = false,
  ): Promise<CriticalCareAlert[]> {
    return await this.alertRepository.find({
      where: {
        patientId,
        ...(includeAcknowledged ? {} : { acknowledged: false }),
      },
      order: { createdAt: 'DESC' },
    });
  }

  async acknowledgeCriticalAlert(alertId: string, acknowledgedBy: string): Promise<CriticalCareAlert> {
    const alert = await this.alertRepository.findOne({ where: { id: alertId } });
    if (!alert) throw new NotFoundException(`Critical alert ${alertId} not found`);
    alert.acknowledged = true;
    alert.acknowledgedBy = acknowledgedBy;
    alert.acknowledgedAt = new Date();
    return await this.alertRepository.save(alert);
  }

  async createResource(dto: CreateResourceDto): Promise<EmergencyResource> {
    const resource = this.resourceRepository.create({
      ...dto,
      availableUnits: dto.totalUnits,
      status: dto.totalUnits > 0 ? EmergencyResourceStatus.AVAILABLE : EmergencyResourceStatus.UNAVAILABLE,
    });
    return await this.resourceRepository.save(resource);
  }

  async allocateResource(id: string, dto: UpdateResourceAllocationDto): Promise<EmergencyResource> {
    const resource = await this.findResource(id);
    resource.availableUnits = Math.max(0, resource.availableUnits - dto.quantity);
    resource.status = this.resolveResourceStatus(resource.availableUnits, resource.totalUnits);
    return await this.resourceRepository.save(resource);
  }

  async releaseResource(id: string, dto: UpdateResourceAllocationDto): Promise<EmergencyResource> {
    const resource = await this.findResource(id);
    resource.availableUnits = Math.min(resource.totalUnits, resource.availableUnits + dto.quantity);
    resource.status = this.resolveResourceStatus(resource.availableUnits, resource.totalUnits);
    return await this.resourceRepository.save(resource);
  }

  async listResources(status?: EmergencyResourceStatus): Promise<EmergencyResource[]> {
    return await this.resourceRepository.find({
      where: status ? { status } : {},
      order: { updatedAt: 'DESC' },
    });
  }

  async createRapidResponse(dto: CreateRapidResponseDto): Promise<RapidResponseEvent> {
    const event = this.rapidResponseRepository.create({
      ...dto,
      activatedAt: new Date(),
      status: RapidResponseStatus.ACTIVE,
    });
    return await this.rapidResponseRepository.save(event);
  }

  async updateRapidResponseStatus(
    id: string,
    dto: UpdateRapidResponseStatusDto,
  ): Promise<RapidResponseEvent> {
    const event = await this.findRapidResponse(id);
    event.status = dto.status;
    if (dto.notes) {
      event.notes = event.notes ? `${event.notes}\n${dto.notes}` : dto.notes;
    }
    if (dto.status === RapidResponseStatus.RESOLVED || dto.status === RapidResponseStatus.CANCELLED) {
      event.resolvedAt = new Date();
    }
    return await this.rapidResponseRepository.save(event);
  }

  async createEmergencyChartNote(dto: CreateEmergencyChartNoteDto): Promise<EmergencyChartNote> {
    const note = this.chartNoteRepository.create(dto);
    return await this.chartNoteRepository.save(note);
  }

  async getRapidChartNotes(patientId: string): Promise<EmergencyChartNote[]> {
    return await this.chartNoteRepository.find({
      where: { patientId },
      order: { createdAt: 'DESC' },
    });
  }

  async createDisasterIncident(dto: CreateDisasterIncidentDto): Promise<DisasterIncident> {
    const incident = this.disasterRepository.create({
      ...dto,
      startTime: dto.startTime ? new Date(dto.startTime) : new Date(),
      status: DisasterIncidentStatus.ACTIVE,
    });
    return await this.disasterRepository.save(incident);
  }

  async updateDisasterIncidentStatus(
    id: string,
    dto: UpdateDisasterIncidentStatusDto,
  ): Promise<DisasterIncident> {
    const incident = await this.findIncident(id);
    incident.status = dto.status;
    if (dto.endTime) incident.endTime = new Date(dto.endTime);
    if (typeof dto.casualtyCount === 'number') incident.casualtyCount = dto.casualtyCount;
    if (dto.triageSummary) incident.triageSummary = dto.triageSummary;
    if (dto.resourceSummary) incident.resourceSummary = dto.resourceSummary;
    if (dto.notes) incident.notes = dto.notes;
    return await this.disasterRepository.save(incident);
  }

  async getActiveDisasterIncidents(): Promise<DisasterIncident[]> {
    return await this.disasterRepository.find({
      where: { status: DisasterIncidentStatus.ACTIVE },
      order: { createdAt: 'DESC' },
    });
  }

  private async findTriageCase(id: string): Promise<EmergencyTriageCase> {
    const item = await this.triageRepository.findOne({ where: { id } });
    if (!item) throw new NotFoundException(`Triage case ${id} not found`);
    return item;
  }

  private async findResource(id: string): Promise<EmergencyResource> {
    const item = await this.resourceRepository.findOne({ where: { id } });
    if (!item) throw new NotFoundException(`Emergency resource ${id} not found`);
    return item;
  }

  private async findRapidResponse(id: string): Promise<RapidResponseEvent> {
    const item = await this.rapidResponseRepository.findOne({ where: { id } });
    if (!item) throw new NotFoundException(`Rapid response event ${id} not found`);
    return item;
  }

  private async findIncident(id: string): Promise<DisasterIncident> {
    const item = await this.disasterRepository.findOne({ where: { id } });
    if (!item) throw new NotFoundException(`Disaster incident ${id} not found`);
    return item;
  }

  private resolveResourceStatus(availableUnits: number, totalUnits: number): EmergencyResourceStatus {
    if (availableUnits <= 0) return EmergencyResourceStatus.UNAVAILABLE;
    const ratio = totalUnits > 0 ? availableUnits / totalUnits : 0;
    if (ratio <= 0.25) return EmergencyResourceStatus.LIMITED;
    return EmergencyResourceStatus.AVAILABLE;
  }

  private isThresholdBreach(metricType: string, value: number): boolean {
    const key = metricType.toLowerCase();
    if (key.includes('spo2')) return value < 90;
    if (key.includes('heart_rate') || key.includes('hr')) return value < 45 || value > 130;
    if (key.includes('resp')) return value < 8 || value > 30;
    if (key.includes('systolic')) return value < 85 || value > 190;
    if (key.includes('diastolic')) return value < 50 || value > 120;
    return false;
  }

  private estimateSeverity(metricType: string, value: number): CriticalAlertSeverity {
    const key = metricType.toLowerCase();
    if (key.includes('spo2') && value < 85) return CriticalAlertSeverity.CRITICAL;
    if ((key.includes('heart_rate') || key.includes('hr')) && (value < 35 || value > 150)) {
      return CriticalAlertSeverity.CRITICAL;
    }
    if (key.includes('systolic') && (value < 75 || value > 210)) return CriticalAlertSeverity.CRITICAL;
    return CriticalAlertSeverity.WARNING;
  }
}
