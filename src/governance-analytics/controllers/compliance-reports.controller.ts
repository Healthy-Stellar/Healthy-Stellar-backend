import { Body, Controller, ForbiddenException, Get, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { API_BEARER_AUTH_SCHEME } from '../../common/constants/swagger.constants';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../auth/entities/user.entity';
import { ComplianceReportsService } from '../services/compliance-reports.service';
import { GenerateComplianceReportDto } from '../dto/compliance-report.dto';

@ApiTags('Governance Compliance Reports')
@ApiBearerAuth(API_BEARER_AUTH_SCHEME)
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.COMPLIANCE_OFFICER, UserRole.SUPER_ADMIN)
@Controller('governance/reports')
export class ComplianceReportsController {
  constructor(private readonly complianceReportsService: ComplianceReportsService) {}

  /** Caller's tenant; null (platform-wide) is allowed for SUPER_ADMIN only. */
  private resolveTenantScope(user: any): string | null {
    const tenantId: string | null = user?.organizationId ?? user?.tenantId ?? null;
    if (!tenantId && user?.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Compliance reports require a tenant-scoped account');
    }
    return tenantId;
  }

  @Post('generate')
  @ApiOperation({
    summary: 'Generate a compliance report',
    description: 'Queues an async job that builds a HIPAA/GDPR/SOC2 compliance report for the given date range',
  })
  @ApiResponse({ status: 202, description: 'Report generation queued' })
  async generate(@Req() req: any, @Body() dto: GenerateComplianceReportDto) {
    return this.complianceReportsService.requestReport(
      dto,
      req.user?.userId,
      this.resolveTenantScope(req.user),
    );
  }

  @Get(':jobId')
  @ApiOperation({ summary: 'Get compliance report job status/summary' })
  @ApiParam({ name: 'jobId' })
  async getStatus(@Req() req: any, @Param('jobId') jobId: string) {
    return this.complianceReportsService.getJob(jobId, this.resolveTenantScope(req.user));
  }

  @Get(':jobId/download')
  @ApiOperation({ summary: 'Download the generated compliance report' })
  @ApiParam({ name: 'jobId' })
  @ApiQuery({ name: 'format', enum: ['pdf', 'csv'], required: false })
  async download(
    @Req() req: any,
    @Param('jobId') jobId: string,
    @Query('format') format: 'pdf' | 'csv' = 'pdf',
    @Res() res: Response,
  ) {
    const buffer = await this.complianceReportsService.download(
      jobId,
      format,
      this.resolveTenantScope(req.user),
      req.user?.userId,
    );
    res.set({
      'Content-Type': format === 'pdf' ? 'application/pdf' : 'text/csv',
      'Content-Disposition': `attachment; filename="compliance-report-${jobId}.${format}"`,
    });
    res.send(buffer);
  }
}
