import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { SystemHealthService } from '../services/system-health.service';
import { DashboardService } from '../services/dashboard.service';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../auth/enums/user-role.enum';

@ApiTags('healthcare-monitoring')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('healthcare-monitoring')
export class HealthcareMonitoringController {
  constructor(
    private systemHealthService: SystemHealthService,
    private dashboardService: DashboardService,
  ) {}

  @Get('health')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async getSystemHealth() {
    return await this.systemHealthService.getSystemHealth();
  }

  @Get('dashboard/overview')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.DOCTOR, UserRole.NURSE)
  async getOverviewDashboard(@Req() req: any) {
    return await this.dashboardService.getOverviewDashboard(req.user?.tenantId);
  }

  @Get('dashboard/system')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async getSystemDashboard() {
    return await this.dashboardService.getSystemHealthDashboard();
  }

  @Get('metrics')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async getMetrics(@Query('type') type?: string, @Query('hours') hours: number = 24) {
    // Implementation for retrieving specific metrics
    return {
      message: 'Metrics endpoint',
      type,
      hours,
    };
  }
}
