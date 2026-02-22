import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from '../services/dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get('overview')
  async getOverviewDashboard() {
    return await this.dashboardService.getOverviewDashboard();
  }

  @Get('system-health')
  async getSystemHealthDashboard() {
    return await this.dashboardService.getSystemHealthDashboard();
  }

  @Get('clinical')
  async getClinicalDashboard() {
    return await this.dashboardService.getClinicalDashboard();
  }

  @Get('equipment')
  async getEquipmentDashboard() {
    return await this.dashboardService.getEquipmentDashboard();
  }

  @Get('compliance')
  async getComplianceDashboard() {
    return await this.dashboardService.getComplianceDashboard();
  }

  @Get('incidents')
  async getIncidentDashboard() {
    return await this.dashboardService.getIncidentDashboard();
  }
}