import { Injectable } from '@nestjs/common';
import { SystemHealthService } from './system-health.service';
import { ClinicalAlertService } from './clinical-alert.service';
import { EquipmentMonitoringService } from './equipment-monitoring.service';
import { ComplianceMonitoringService } from './compliance-monitoring.service';
import { IncidentTrackingService } from './incident-tracking.service';

@Injectable()
export class DashboardService {
  constructor(
    private systemHealthService: SystemHealthService,
    private clinicalAlertService: ClinicalAlertService,
    private equipmentMonitoringService: EquipmentMonitoringService,
    private complianceMonitoringService: ComplianceMonitoringService,
    private incidentTrackingService: IncidentTrackingService,
  ) {}

  async getOverviewDashboard(): Promise<any> {
    const [systemHealth, activeAlerts, equipmentMetrics, complianceStatus, incidentMetrics] =
      await Promise.all([
        this.systemHealthService.getSystemHealth(),
        this.clinicalAlertService.getActiveAlerts(),
        this.equipmentMonitoringService.getEquipmentMetrics(),
        this.complianceMonitoringService.getComplianceStatus(),
        this.getRecentIncidentMetrics(),
      ]);

    return {
      timestamp: new Date(),
      systemHealth: {
        status: systemHealth.overall,
        criticalMetrics: systemHealth.alerts.length,
        uptime: '99.9%', // Mock data
      },
      alerts: {
        active: activeAlerts.length,
        critical: activeAlerts.filter((a) => a.priority === 'critical').length,
        high: activeAlerts.filter((a) => a.priority === 'high').length,
        recent: activeAlerts.slice(0, 5),
      },
      equipment: {
        total: equipmentMetrics.total,
        operational: equipmentMetrics.byStatus.operational || 0,
        warning: equipmentMetrics.byStatus.warning || 0,
        critical: equipmentMetrics.byStatus.critical || 0,
        offline: equipmentMetrics.byStatus.offline || 0,
        maintenanceDue: equipmentMetrics.maintenanceDue,
      },
      compliance: {
        status: complianceStatus.overall,
        compliant: complianceStatus.compliant,
        nonCompliant: complianceStatus.nonCompliant,
        pendingReview: complianceStatus.pendingReview,
        recentViolations: complianceStatus.recentViolations.slice(0, 3),
      },
      incidents: {
        total: incidentMetrics.total,
        open: incidentMetrics.openIncidents,
        resolved: incidentMetrics.total - incidentMetrics.openIncidents,
        averageResolutionTime: incidentMetrics.averageResolutionTime,
        requiresRegulatoryCommunication: incidentMetrics.requiresRegulatoryCommunication,
      },
    };
  }

  async getSystemHealthDashboard(): Promise<any> {
    const systemHealth = await this.systemHealthService.getSystemHealth();

    return {
      timestamp: new Date(),
      overall: systemHealth.overall,
      metrics: systemHealth.metrics,
      alerts: systemHealth.alerts,
      performance: {
        responseTime: systemHealth.metrics.api_response_time?.current || 0,
        throughput: null,
        errorRate: null,
        notAvailable: ['throughput', 'errorRate'],
      },
      resources: {
        cpu: systemHealth.metrics.cpu_usage?.current || 0,
        memory: systemHealth.metrics.memory_usage?.current || 0,
        disk: null,
        network: null,
        notAvailable: ['disk', 'network'],
      },
    };
  }

  async getClinicalDashboard(): Promise<any> {
    const [activeAlerts, alertMetrics] = await Promise.all([
      this.clinicalAlertService.getActiveAlerts(),
      this.getAlertMetrics(),
    ]);

    return {
      timestamp: new Date(),
      activeAlerts: {
        total: activeAlerts.length,
        critical: activeAlerts.filter((a) => a.priority === 'critical').length,
        high: activeAlerts.filter((a) => a.priority === 'high').length,
        medium: activeAlerts.filter((a) => a.priority === 'medium').length,
        low: activeAlerts.filter((a) => a.priority === 'low').length,
      },
      alertsByType: alertMetrics.byType,
      alertsByDepartment: this.groupAlertsByDepartment(activeAlerts),
      recentAlerts: activeAlerts.slice(0, 10),
      responseMetrics: {
        averageAcknowledgmentTime: alertMetrics.averageResolutionTime * 0.3, // Mock calculation
        averageResolutionTime: alertMetrics.averageResolutionTime,
        acknowledgmentRate: 95, // Mock data
      },
    };
  }

  async getEquipmentDashboard(): Promise<any> {
    const equipmentMetrics = await this.equipmentMonitoringService.getEquipmentMetrics();

    return {
      timestamp: new Date(),
      overview: {
        total: equipmentMetrics.total,
        operational: equipmentMetrics.byStatus.operational || 0,
        warning: equipmentMetrics.byStatus.warning || 0,
        critical: equipmentMetrics.byStatus.critical || 0,
        offline: equipmentMetrics.byStatus.offline || 0,
        maintenance: equipmentMetrics.byStatus.maintenance || 0,
      },
      byType: equipmentMetrics.byType,
      byDepartment: equipmentMetrics.byDepartment,
      maintenance: {
        due: equipmentMetrics.maintenanceDue,
        overdue: Math.floor(equipmentMetrics.maintenanceDue * 0.3), // Mock calculation
        scheduled: null,
        notAvailable: ['scheduled'],
      },
      utilization: {
        high: null,
        medium: null,
        low: null,
        notAvailable: ['high', 'medium', 'low'],
      },
    };
  }

  async getComplianceDashboard(): Promise<any> {
    const complianceStatus = await this.complianceMonitoringService.getComplianceStatus();

    return {
      timestamp: new Date(),
      overview: {
        status: complianceStatus.overall,
        totalChecks: complianceStatus.totalChecks,
        compliant: complianceStatus.compliant,
        nonCompliant: complianceStatus.nonCompliant,
        pendingReview: complianceStatus.pendingReview,
        complianceRate: ((complianceStatus.compliant / complianceStatus.totalChecks) * 100).toFixed(
          1,
        ),
      },
      byType: complianceStatus.byType,
      bySeverity: complianceStatus.bySeverity,
      recentViolations: complianceStatus.recentViolations,
      trends: {
        improving: null,
        riskAreas: ['Data Security', 'Access Control'], // Mock data
        notAvailable: ['improving'],
      },
    };
  }

  async getIncidentDashboard(): Promise<any> {
    const [incidentMetrics, trendAnalysis] = await Promise.all([
      this.getRecentIncidentMetrics(),
      this.incidentTrackingService.getTrendAnalysis(6),
    ]);

    return {
      timestamp: new Date(),
      overview: {
        total: incidentMetrics.total,
        open: incidentMetrics.openIncidents,
        investigating: incidentMetrics.byStatus.investigating || 0,
        resolved: incidentMetrics.byStatus.resolved || 0,
        closed: incidentMetrics.byStatus.closed || 0,
        averageResolutionTime: incidentMetrics.averageResolutionTime,
      },
      byType: incidentMetrics.byType,
      bySeverity: incidentMetrics.bySeverity,
      byDepartment: incidentMetrics.byDepartment,
      trends: {
        monthlyIncidents: trendAnalysis.monthlyIncidents,
        mostCommonTypes: trendAnalysis.mostCommonTypes,
        severityTrends: trendAnalysis.severityTrends,
      },
      regulatory: {
        requiresCommunication: incidentMetrics.requiresRegulatoryCommunication,
        reportingRate: 100, // Mock data
      },
    };
  }

  private async getRecentIncidentMetrics(): Promise<any> {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000); // Last 30 days

    return await this.incidentTrackingService.getIncidentMetrics({
      start: startDate,
      end: endDate,
    });
  }

  private async getAlertMetrics(): Promise<any> {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000); // Last 30 days

    return await this.clinicalAlertService.getAlertMetrics({
      start: startDate,
      end: endDate,
    });
  }

  private groupAlertsByDepartment(alerts: any[]): Record<string, number> {
    return alerts.reduce((acc, alert) => {
      const dept = alert.department || 'Unknown';
      acc[dept] = (acc[dept] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }
}
