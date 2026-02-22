import { Controller, Get, Query } from '@nestjs/common';
import { SystemHealthService } from '../services/system-health.service';
import { DashboardService } from '../services/dashboard.service';

@Controller('healthcare-monitoring')
export class HealthcareMonitoringController {
  constructor(
    private systemHealthService: SystemHealthService,
    private dashboardService: DashboardService,
  ) {}

  @Get('health')
  async getSystemHealth() {
    return await this.systemHealthService.getSystemHealth();
  }

  @Get('dashboard/overview')
  async getOverviewDashboard() {
    return await this.dashboardService.getOverviewDashboard();
  }

  @Get('dashboard/system')
  async getSystemDashboard() {
    return await this.dashboardService.getSystemHealthDashboard();
  }

  @Get('metrics')
  async getMetrics(
    @Query('type') type?: string,
    @Query('hours') hours: number = 24,
  ) {
    // Implementation for retrieving specific metrics
    return {
      message: 'Metrics endpoint',
      type,
      hours,
    };
  }
}