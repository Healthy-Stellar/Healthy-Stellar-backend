import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { PathologyReportService } from '../services/pathology-report.service';
import { ReportTemplateService } from '../services/report-template.service';
import { CreatePathologyReportDto } from '../dto/create-pathology-report.dto';
import { CreateReportTemplateDto } from '../dto/create-report-template.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Controller('pathology/reports')
@UseGuards(JwtAuthGuard)
export class PathologyReportController {
  constructor(
    private readonly reportService: PathologyReportService,
    private readonly templateService: ReportTemplateService,
  ) {}

  @Post()
  createReport(@Body() createDto: CreatePathologyReportDto, @Request() req) {
    return this.reportService.create(createDto, req.user.userId);
  }

  @Get(':id')
  findReport(@Param('id') id: string) {
    return this.reportService.findOne(id);
  }

  @Get('case/:caseId')
  findReportsByCase(@Param('caseId') caseId: string) {
    return this.reportService.findByCase(caseId);
  }

  @Post(':id/finalize')
  finalizeReport(@Param('id') id: string, @Body() body: { signature: string }, @Request() req) {
    return this.reportService.finalize(id, body.signature, req.user.userId);
  }

  @Post(':id/amend')
  amendReport(
    @Param('id') id: string,
    @Body() body: { reason: string; changes: string },
    @Request() req,
  ) {
    return this.reportService.amend(id, body.reason, body.changes, req.user.userId);
  }

  @Post(':id/addendum')
  addAddendum(@Param('id') id: string, @Body() body: { addendumText: string }, @Request() req) {
    return this.reportService.addAddendum(id, body.addendumText, req.user.userId);
  }

  // Template endpoints
  @Post('templates')
  createTemplate(@Body() createDto: CreateReportTemplateDto, @Request() req) {
    return this.templateService.create(createDto, req.user.userId);
  }

  @Get('templates')
  findAllTemplates() {
    return this.templateService.findAll();
  }

  @Get('templates/:id')
  findTemplate(@Param('id') id: string) {
    return this.templateService.findOne(id);
  }

  @Get('templates/organ/:organType')
  findTemplatesByOrgan(@Param('organType') organType: string) {
    return this.templateService.findByOrgan(organType);
  }

  @Post('templates/:id/activate')
  activateTemplate(@Param('id') id: string, @Request() req) {
    return this.templateService.activate(id, req.user.userId);
  }

  @Post('templates/:id/deactivate')
  deactivateTemplate(@Param('id') id: string, @Request() req) {
    return this.templateService.deactivate(id, req.user.userId);
  }
}
