import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HealthcareIncident, IncidentType, IncidentSeverity, IncidentStatus } from '../entities/healthcare-incident.entity';
import { NotificationService } from './notification.service';

@Injectable()
export class IncidentTrackingService {
  private readonly logger = new Logger(IncidentTrackingService.name);

  constructor(
    @InjectRepository(HealthcareIncident)
    private incidentRepository: Repository<HealthcareIncident>,
    private notificationService: NotificationService,
  ) {}

  async reportIncident(incidentData: {
    incidentType: IncidentType;
    severity: IncidentSeverity;
    title: string;
    description: string;
    department: string;
    location?: string;
    patientId?: string;
    staffId?: string;
    equipmentId?: string;
    reportedBy: string;
    witnesses?: Record<string, any>[];
    attachments?: string[];
  }): Promise<HealthcareIncident> {
    const incidentNumber = await this.generateIncidentNumber();
    
    const incident = this.incidentRepository.create({
      ...incidentData,
      incidentNumber,
      status: IncidentStatus.REPORTED,
      reportedAt: new Date(),
      timeline: [{
        timestamp: new Date(),
        action: 'incident_reported',
        userId: incidentData.reportedBy,
        description: 'Incident reported',
      }],
    });

    const savedIncident = await this.incidentRepository.save(incident);
    
    // Send notifications for high severity incidents
    if (savedIncident.severity === IncidentSeverity.MAJOR || 
        savedIncident.severity === IncidentSeverity.CATASTROPHIC) {
      await this.notificationService.sendIncidentNotification(savedIncident);
    }

    this.logger.log(`Healthcare incident reported: ${savedIncident.incidentNumber}`);
    return savedIncident;
  }

  async assignIncident(incidentId: string, assignedTo: string, assignedBy: string): Promise<HealthcareIncident> {
    const incident = await this.incidentRepository.findOne({ where: { id: incidentId } });
    if (!incident) {
      throw new Error('Incident not found');
    }

    incident.assignedTo = assignedTo;
    incident.timeline.push({
      timestamp: new Date(),
      action: 'incident_assigned',
      userId: assignedBy,
      description: `Incident assigned to user ${assignedTo}`,
    });

    return await this.incidentRepository.save(incident);
  }

  async startInvestigation(incidentId: string, investigatorId: string): Promise<HealthcareIncident> {
    const incident = await this.incidentRepository.findOne({ where: { id: incidentId } });
    if (!incident) {
      throw new Error('Incident not found');
    }

    incident.status = IncidentStatus.INVESTIGATING;
    incident.investigatedBy = investigatorId;
    incident.investigationStarted = new Date();
    incident.timeline.push({
      timestamp: new Date(),
      action: 'investigation_started',
      userId: investigatorId,
      description: 'Investigation started',
    });

    return await this.incidentRepository.save(incident);
  }

  async updateInvestigation(
    incidentId: string, 
    updateData: {
      rootCause?: string;
      correctiveActions?: string;
      preventiveActions?: string;
      investigationNotes?: string;
    },
    userId: string
  ): Promise<HealthcareIncident> {
    const incident = await this.incidentRepository.findOne({ where: { id: incidentId } });
    if (!incident) {
      throw new Error('Incident not found');
    }

    Object.assign(incident, updateData);
    incident.timeline.push({
      timestamp: new Date(),
      action: 'investigation_updated',
      userId,
      description: 'Investigation details updated',
    });

    return await this.incidentRepository.save(incident);
  }

  async resolveIncident(
    incidentId: string, 
    resolutionData: {
      rootCause: string;
      correctiveActions: string;
      preventiveActions: string;
    },
    userId: string
  ): Promise<HealthcareIncident> {
    const incident = await this.incidentRepository.findOne({ where: { id: incidentId } });
    if (!incident) {
      throw new Error('Incident not found');
    }

    incident.status = IncidentStatus.RESOLVED;
    incident.rootCause = resolutionData.rootCause;
    incident.correctiveActions = resolutionData.correctiveActions;
    incident.preventiveActions = resolutionData.preventiveActions;
    incident.investigationCompleted = new Date();
    incident.resolvedAt = new Date();
    incident.timeline.push({
      timestamp: new Date(),
      action: 'incident_resolved',
      userId,
      description: 'Incident resolved',
    });

    const resolvedIncident = await this.incidentRepository.save(incident);

    // Check if regulatory communication is required
    if (incident.requiresRegulatoryCommunication) {
      await this.notificationService.sendRegulatoryNotification(resolvedIncident);
    }

    return resolvedIncident;
  }

  async closeIncident(incidentId: string, userId: string): Promise<HealthcareIncident> {
    const incident = await this.incidentRepository.findOne({ where: { id: incidentId } });
    if (!incident) {
      throw new Error('Incident not found');
    }

    if (incident.status !== IncidentStatus.RESOLVED) {
      throw new Error('Incident must be resolved before closing');
    }

    incident.status = IncidentStatus.CLOSED;
    incident.timeline.push({
      timestamp: new Date(),
      action: 'incident_closed',
      userId,
      description: 'Incident closed',
    });

    return await this.incidentRepository.save(incident);
  }

  async getIncidentsByDepartment(department: string, status?: IncidentStatus): Promise<HealthcareIncident[]> {
    const query = this.incidentRepository
      .createQueryBuilder('incident')
      .where('incident.department = :department', { department })
      .orderBy('incident.reportedAt', 'DESC');

    if (status) {
      query.andWhere('incident.status = :status', { status });
    }

    return query.getMany();
  }

  async getIncidentMetrics(timeRange: { start: Date; end: Date }): Promise<any> {
    const incidents = await this.incidentRepository
      .createQueryBuilder('incident')
      .where('incident.reportedAt BETWEEN :start AND :end', timeRange)
      .getMany();

    const metrics = {
      total: incidents.length,
      byType: {},
      bySeverity: {},
      byStatus: {},
      byDepartment: {},
      averageResolutionTime: 0,
      openIncidents: 0,
      requiresRegulatoryCommunication: 0,
    };

    let totalResolutionTime = 0;
    let resolvedCount = 0;

    incidents.forEach(incident => {
      // Count by type
      metrics.byType[incident.incidentType] = (metrics.byType[incident.incidentType] || 0) + 1;
      
      // Count by severity
      metrics.bySeverity[incident.severity] = (metrics.bySeverity[incident.severity] || 0) + 1;
      
      // Count by status
      metrics.byStatus[incident.status] = (metrics.byStatus[incident.status] || 0) + 1;
      
      // Count by department
      metrics.byDepartment[incident.department] = (metrics.byDepartment[incident.department] || 0) + 1;

      // Calculate resolution time
      if (incident.status === IncidentStatus.RESOLVED && incident.resolvedAt) {
        const resolutionTime = incident.resolvedAt.getTime() - incident.reportedAt.getTime();
        totalResolutionTime += resolutionTime;
        resolvedCount++;
      }

      // Count open incidents
      if (incident.status === IncidentStatus.REPORTED || incident.status === IncidentStatus.INVESTIGATING) {
        metrics.openIncidents++;
      }

      // Count regulatory communication required
      if (incident.requiresRegulatoryCommunication) {
        metrics.requiresRegulatoryCommunication++;
      }
    });

    if (resolvedCount > 0) {
      metrics.averageResolutionTime = totalResolutionTime / resolvedCount / (1000 * 60 * 60); // in hours
    }

    return metrics;
  }

  async getTrendAnalysis(months: number = 6): Promise<any> {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const incidents = await this.incidentRepository
      .createQueryBuilder('incident')
      .where('incident.reportedAt >= :startDate', { startDate })
      .orderBy('incident.reportedAt', 'ASC')
      .getMany();

    const monthlyData = {};
    const typeFrequency = {};
    const severityTrends = {};

    incidents.forEach(incident => {
      const monthKey = incident.reportedAt.toISOString().substring(0, 7); // YYYY-MM
      
      // Monthly incident count
      monthlyData[monthKey] = (monthlyData[monthKey] || 0) + 1;
      
      // Type frequency
      typeFrequency[incident.incidentType] = (typeFrequency[incident.incidentType] || 0) + 1;
      
      // Severity trends
      if (!severityTrends[monthKey]) {
        severityTrends[monthKey] = {};
      }
      severityTrends[monthKey][incident.severity] = (severityTrends[monthKey][incident.severity] || 0) + 1;
    });

    return {
      monthlyIncidents: monthlyData,
      mostCommonTypes: Object.entries(typeFrequency)
        .sort(([,a], [,b]) => (b as number) - (a as number))
        .slice(0, 5),
      severityTrends,
      totalIncidents: incidents.length,
    };
  }

  private async generateIncidentNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.incidentRepository.count({
      where: {
        incidentNumber: Like(`INC-${year}-%`)
      }
    });
    
    return `INC-${year}-${String(count + 1).padStart(4, '0')}`;
  }
}

// Import Like operator
import { Like } from 'typeorm';