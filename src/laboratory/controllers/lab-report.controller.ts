import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { LabReportService } from '../services/lab-report.service';
import { CreateLabReportTemplateDto } from '../dto/create-lab-report-template.dto';
import { ReportType } from '../entities/lab-report-template.entity';
import { ReportStatus } from '../entities/lab-report.entity';

@ApiTags('Lab Reports')
@Controller('lab-reports')
export class LabReportController {
  constructor(private readonly reportService: LabReportService) {}

  @Post('templates')
  @ApiOperation({ summary: 'Create a new report template' })
  @ApiResponse({ status: 201, description: 'Template created successfully' })
  createTemplate(@Body() createTemplateDto: CreateLabReportTemplateDto) {
    return this.reportService.createTemplate(createTemplateDto);
  }

  @Get('templates')
  @ApiOperation({ summary: 'Get all report templates' })
  @ApiResponse({ status: 200, description: 'List of all templates' })
  findAllTemplates() {
    return this.reportService.findAllTemplates();
  }

  @Get('templates/type/:type')
  @ApiOperation({ summary: 'Get templates by type' })
  @ApiResponse({ status: 200, description: 'List of templates by type' })
  findTemplatesByType(@Param('type') type: ReportType) {
    return this.reportService.findTemplatesByType(type);
  }

  @Post('generate')
  @ApiOperation({ summary: 'Generate a new report' })
  @ApiResponse({ status: 201, description: 'Report generation started' })
  generateReport(
    @Body('templateId') templateId: string,
    @Body('labOrderId') labOrderId: string,
    @Body('generatedBy') generatedBy: string,
    @Body('parameters') parameters?: any,
  ) {
    return this.reportService.generateReport(templateId, labOrderId, generatedBy, parameters);
  }

  @Get()
  @ApiOperation({ summary: 'Get all reports' })
  @ApiResponse({ status: 200, description: 'List of all reports' })
  findAllReports() {
    return this.reportService.findAllReports();
  }

  @Get('status/:status')
  @ApiOperation({ summary: 'Get reports by status' })
  @ApiResponse({ status: 200, description: 'List of reports with specified status' })
  findReportsByStatus(@Param('status') status: ReportStatus) {
    return this.reportService.findReportsByStatus(status);
  }

  @Get('lab-order/:labOrderId')
  @ApiOperation({ summary: 'Get reports for a lab order' })
  @ApiResponse({ status: 200, description: 'List of reports for the lab order' })
  findReportsByLabOrder(@Param('labOrderId') labOrderId: string) {
    return this.reportService.findReportsByLabOrder(labOrderId);
  }

  @Post(':id/send')
  @ApiOperation({ summary: 'Send a completed report' })
  @ApiResponse({ status: 200, description: 'Report sent successfully' })
  sendReport(@Param('id') id: string, @Body('sentTo') sentTo: string) {
    return this.reportService.sendReport(id, sentTo);
  }
}
