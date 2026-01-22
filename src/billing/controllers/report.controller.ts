import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { ReportService } from '../services/report.service';
import {
  GenerateReportDto,
  ReportSearchDto,
  ARAgingReportDto,
  DenialAnalysisDto,
  ReportType,
  PeriodType,
} from '../dto/report.dto';

@ApiTags('reports')
@Controller('reports')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Post('generate')
  @ApiOperation({ summary: 'Generate a revenue cycle report' })
  @ApiResponse({ status: 201, description: 'Report generated successfully' })
  async generateReport(@Body() generateDto: GenerateReportDto) {
    return this.reportService.generateReport(generateDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get report history' })
  @ApiQuery({ name: 'reportType', required: false, enum: ReportType })
  @ApiQuery({ name: 'periodType', required: false, enum: PeriodType })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiResponse({ status: 200, description: 'Report history retrieved' })
  async getReportHistory(
    @Query('reportType') reportType?: ReportType,
    @Query('periodType') periodType?: PeriodType,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportService.getReportHistory({
      reportType,
      periodType,
      startDate,
      endDate,
    });
  }

  @Post('ar-aging')
  @ApiOperation({ summary: 'Generate A/R aging report' })
  @ApiResponse({ status: 200, description: 'A/R aging report generated' })
  async getARAgingReport(@Body() arAgingDto: ARAgingReportDto) {
    return this.reportService.getARAgingReport(arAgingDto);
  }

  @Post('denial-analysis')
  @ApiOperation({ summary: 'Generate denial analysis report' })
  @ApiResponse({ status: 200, description: 'Denial analysis report generated' })
  async getDenialAnalysisReport(@Body() analysisDto: DenialAnalysisDto) {
    return this.reportService.getDenialAnalysisReport(analysisDto);
  }
}
