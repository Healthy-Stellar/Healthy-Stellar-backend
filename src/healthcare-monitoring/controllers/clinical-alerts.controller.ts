import { Controller, Get, Post, Put, Body, Param, Query } from '@nestjs/common';
import { ClinicalAlertService } from '../services/clinical-alert.service';
import { DashboardService } from '../services/dashboard.service';
import { AlertType, AlertPriority } from '../entities/clinical-alert.entity';

@Controller('clinical-alerts')
export class ClinicalAlertsController {
  constructor(
    private clinicalAlertService: ClinicalAlertService,
    private dashboardService: DashboardService,
  ) {}

  @Get()
  async getActiveAlerts(
    @Query('department') department?: string,
    @Query('priority') priority?: AlertPriority,
    @Query('type') alertType?: AlertType,
  ) {
    return await this.clinicalAlertService.getActiveAlerts({
      department,
      priority,
      alertType,
    });
  }

  @Post()
  async createAlert(@Body() alertData: {
    alertType: AlertType;
    priority: AlertPriority;
    title: string;
    message: string;
    patientId?: string;
    department?: string;
    room?: string;
    equipmentId?: string;
    alertData?: Record<string, any>;
  }) {
    return await this.clinicalAlertService.createAlert(alertData);
  }

  @Put(':id/acknowledge')
  async acknowledgeAlert(
    @Param('id') alertId: string,
    @Body() body: { userId: string },
  ) {
    return await this.clinicalAlertService.acknowledgeAlert(alertId, body.userId);
  }

  @Put(':id/resolve')
  async resolveAlert(
    @Param('id') alertId: string,
    @Body() body: { userId: string; resolutionNotes?: string },
  ) {
    return await this.clinicalAlertService.resolveAlert(
      alertId,
      body.userId,
      body.resolutionNotes,
    );
  }

  @Get('dashboard')
  async getClinicalDashboard() {
    return await this.dashboardService.getClinicalDashboard();
  }

  @Get('metrics')
  async getAlertMetrics(
    @Query('days') days: number = 30,
  ) {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);
    
    return await this.clinicalAlertService.getAlertMetrics({
      start: startDate,
      end: endDate,
    });
  }
}