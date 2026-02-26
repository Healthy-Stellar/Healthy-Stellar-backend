import { Controller, Get, Post, Param, Query, Body, Res, HttpStatus, NotFoundException, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { ReportingService } from '../services/reporting.service';
import { ReportGenerationService } from '../services/report-generation.service';
import { IpfsService } from '../services/ipfs.service';
import { GenerateReportDto } from '../dto/generate-report.dto';

@ApiTags('Reporting')
@Controller('reports')
export class ReportingController {
  constructor(
    private readonly reportingService: ReportingService,
    private readonly reportGenerationService: ReportGenerationService,
    private readonly ipfsService: IpfsService,
  ) {}

  @Post('generate')
  @ApiOperation({ summary: 'Queue a report generation job' })
  @ApiResponse({ status: 201, description: 'Report generation queued' })
  async generateReport(@Body() dto: GenerateReportDto) {
    return this.reportGenerationService.queueReportGeneration(dto.patientId, dto.format);
  }

  @Get(':jobId/status')
  @ApiOperation({ summary: 'Get report job status' })
  @ApiResponse({ status: 200, description: 'Job status retrieved' })
  async getJobStatus(@Param('jobId') jobId: string) {
    const status = await this.reportGenerationService.getJobStatus(jobId);
    
    if (!status) {
      throw new NotFoundException('Job not found');
    }

    return status;
  }

  @Get(':jobId/download')
  @ApiOperation({ summary: 'Download generated report' })
  @ApiResponse({ status: 200, description: 'Report file streamed' })
  async downloadReport(
    @Param('jobId') jobId: string,
    @Query('token') token: string,
    @Res() res: Response,
  ) {
    if (!token) {
      throw new BadRequestException('Token required');
    }

    const job = await this.reportGenerationService.validateDownload(jobId, token);

    if (!job) {
      throw new NotFoundException('Invalid job or token');
    }

    if (job['error']) {
      throw new BadRequestException(job['error']);
    }

    const fileBuffer = await this.ipfsService.getFile(job.ipfsHash);
    const contentType = job.format === 'pdf' ? 'application/pdf' : 'text/csv';
    const fileName = `medical-report-${jobId}.${job.format}`;

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(fileBuffer);
  }

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
  async getStatistics(@Query('startDate') startDate?: string, @Query('endDate') endDate?: string) {
    return this.reportingService.getRecordStatistics(
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }
}
