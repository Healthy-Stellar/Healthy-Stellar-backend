import { Controller, Get, Param, Query, UseFilters, UseGuards, Delete, Req, Res, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { FhirService } from '../fhir.service';
import { BulkExportService } from '../services/bulk-export.service';
import { FhirExceptionFilter } from '../filters/fhir-exception.filter';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { BulkExportQueryDto } from '../dto/bulk-export.dto';

@Controller('fhir/r4')
@UseFilters(FhirExceptionFilter)
@UseGuards(JwtAuthGuard)
export class FhirController {
  constructor(
    private readonly fhirService: FhirService,
    private readonly bulkExportService: BulkExportService,
  ) {}

  @Get('metadata')
  getCapabilityStatement() {
    return this.fhirService.getCapabilityStatement();
  }

  @Get('Patient/:id')
  getPatient(@Param('id') id: string) {
    return this.fhirService.getPatient(id);
  }

  @Get('Patient/:id/DocumentReference')
  getPatientDocuments(@Param('id') id: string) {
    return this.fhirService.getPatientDocuments(id);
  }

  @Get('DocumentReference/:id')
  getDocumentReference(@Param('id') id: string) {
    return this.fhirService.getDocumentReference(id);
  }

  @Get('Consent/:id')
  getConsent(@Param('id') id: string) {
    return this.fhirService.getConsent(id);
  }

  @Get('Provenance')
  getProvenance(@Query('target') target?: string) {
    return this.fhirService.getProvenance(target || '');
  }

  @Get('Patient/$export')
  async initiateExport(@Query() query: BulkExportQueryDto, @Req() req: any, @Res() res: Response) {
    const jobId = await this.bulkExportService.initiateExport(
      req.user.id,
      req.user.role,
      query._type,
    );

    res.status(HttpStatus.ACCEPTED)
      .header('Content-Location', `/fhir/r4/$export-status/${jobId}`)
      .send();
  }

  @Get('$export-status/:jobId')
  async getExportStatus(@Param('jobId') jobId: string, @Req() req: any) {
    return this.bulkExportService.getJobStatus(jobId, req.user.id, req.user.role);
  }

  @Delete('$export-status/:jobId')
  async cancelExport(@Param('jobId') jobId: string, @Req() req: any, @Res() res: Response) {
    await this.bulkExportService.cancelJob(jobId, req.user.id, req.user.role);
    res.status(HttpStatus.NO_CONTENT).send();
  }
}
