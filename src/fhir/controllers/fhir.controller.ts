import { Controller, Get, Param, Query, UseFilters, UseGuards } from '@nestjs/common';
import { FhirService } from '../fhir.service';
import { FhirExceptionFilter } from '../filters/fhir-exception.filter';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Controller('fhir/r4')
@UseFilters(FhirExceptionFilter)
@UseGuards(JwtAuthGuard)
export class FhirController {
  constructor(private readonly fhirService: FhirService) {}

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
}
