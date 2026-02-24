import { Controller, Get, Post, Query, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { LabAnalyticsService } from '../services/lab-analytics.service';
import { MetricType, MetricPeriod } from '../entities/lab-analytics.entity';

@ApiTags('Lab Analytics')
@Controller('lab-analytics')
export class LabAnalyticsController {
  constructor(private readonly analyticsService: LabAnalyticsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get analytics dashboard data' })
  @ApiResponse({ status: 200, description: 'Dashboard metrics and trends' })
  getDashboard() {
    return this.analyticsService.getDashboardMetrics();
  }

  @Post('calculate/turnaround-time')
  @ApiOperation({ summary: 'Calculate turnaround time metrics' })
  @ApiResponse({ status: 201, description: 'Turnaround time calculated' })
  @ApiQuery({ name: 'period', enum: MetricPeriod })
  @ApiQuery({ name: 'startDate', type: String })
  @ApiQuery({ name: 'endDate', type: String })
  calculateTurnaroundTime(
    @Query('period') period: MetricPeriod,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.analyticsService.calculateTurnaroundTime(
      period,
      new Date(startDate),
      new Date(endDate),
    );
  }

  @Post('calculate/throughput')
  @ApiOperation({ summary: 'Calculate throughput metrics' })
  @ApiResponse({ status: 201, description: 'Throughput calculated' })
  @ApiQuery({ name: 'period', enum: MetricPeriod })
  @ApiQuery({ name: 'startDate', type: String })
  @ApiQuery({ name: 'endDate', type: String })
  calculateThroughput(
    @Query('period') period: MetricPeriod,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.analyticsService.calculateThroughput(
      period,
      new Date(startDate),
      new Date(endDate),
    );
  }

  @Post('calculate/error-rate')
  @ApiOperation({ summary: 'Calculate error rate metrics' })
  @ApiResponse({ status: 201, description: 'Error rate calculated' })
  @ApiQuery({ name: 'period', enum: MetricPeriod })
  @ApiQuery({ name: 'startDate', type: String })
  @ApiQuery({ name: 'endDate', type: String })
  calculateErrorRate(
    @Query('period') period: MetricPeriod,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.analyticsService.calculateErrorRate(period, new Date(startDate), new Date(endDate));
  }

  @Get('metrics/type/:metricType')
  @ApiOperation({ summary: 'Get metrics by type' })
  @ApiResponse({ status: 200, description: 'List of metrics by type' })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  getMetricsByType(@Param('metricType') metricType: MetricType, @Query('limit') limit?: number) {
    return this.analyticsService.getMetricsByType(metricType, limit);
  }

  @Get('metrics/period/:period')
  @ApiOperation({ summary: 'Get metrics by period' })
  @ApiResponse({ status: 200, description: 'List of metrics for the period' })
  @ApiQuery({ name: 'startDate', type: String })
  @ApiQuery({ name: 'endDate', type: String })
  getMetricsByPeriod(
    @Param('period') period: MetricPeriod,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.analyticsService.getMetricsByPeriod(period, new Date(startDate), new Date(endDate));
  }
}
