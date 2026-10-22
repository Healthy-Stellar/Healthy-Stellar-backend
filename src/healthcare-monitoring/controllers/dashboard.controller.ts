import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from '../services/dashboard.service';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../auth/enums/user-role.enum';

@ApiTags('dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
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
  @Roles(UserRole.ADMIN, UserRole.CLINICAL_STAFF)
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
