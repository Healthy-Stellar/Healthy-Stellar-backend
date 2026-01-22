import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ReportingService } from '../services/reporting.service';

@ApiTags('Reporting')
@Controller('reports')
export class ReportingController {
  constructor(private readonly reportingService: ReportingService) {}

  @Get('patient/:patientId/summary')
  @ApiOperation({ summary: 'Get patient medical records summary' })
  @ApiResponse({ status: 200, description: 'Summary retrieved successfully' })
  async getPatientSummary(
    @Param('patientId') patientId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportingService.getPatientSummary(
      patientId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  @Get('activity')
  @ApiOperation({ summary: 'Get activity report' })
  @ApiResponse({ status: 200, description: 'Activity report retrieved successfully' })
  async getActivityReport(
    @Query('patientId') patientId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportingService.getActivityReport(
      patientId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  @Get('consent')
  @ApiOperation({ summary: 'Get consent report' })
  @ApiResponse({ status: 200, description: 'Consent report retrieved successfully' })
  async getConsentReport(@Query('patientId') patientId?: string) {
    return this.reportingService.getConsentReport(patientId);
  }

  @Get('statistics')
  @ApiOperation({ summary: 'Get medical records statistics' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  async getStatistics(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportingService.getRecordStatistics(
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }
}
