import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { ComplianceMonitoringService } from '../services/compliance-monitoring.service';
import { ComplianceType } from '../entities/compliance-check.entity';

@Controller('compliance')
export class ComplianceController {
  constructor(private complianceService: ComplianceMonitoringService) {}

  @Get('status')
  async getComplianceStatus(@Query('type') complianceType?: ComplianceType) {
    return await this.complianceService.getComplianceStatus(complianceType);
  }

  @Post('run-checks')
  async runComplianceChecks(@Body() body: { checkTypes?: ComplianceType[] }) {
    // Trigger manual compliance checks
    await this.complianceService.runDailyComplianceChecks();
    return { message: 'Compliance checks initiated' };
  }

  @Get('dashboard')
  async getComplianceDashboard() {
    return await this.complianceService.getComplianceStatus();
  }
}