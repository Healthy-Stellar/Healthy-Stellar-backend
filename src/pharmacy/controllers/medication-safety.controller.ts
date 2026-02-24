import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { PatientCounselingService } from '../services/patient-counseling.service';
import { MedicationErrorService, ReportErrorDto } from '../services/medication-error.service';
import {
  PrescriptionValidationService,
  PatientFactors,
} from '../services/prescription-validation.service';

@Controller('pharmacy/safety')
// @UseGuards(JwtAuthGuard)
export class MedicationSafetyController {
  constructor(
    private counselingService: PatientCounselingService,
    private errorService: MedicationErrorService,
    private validationService: PrescriptionValidationService,
  ) {}

  // Patient Counseling Endpoints
  @Post('counseling')
  async logCounselingSession(@Body() sessionDto: any) {
    return await this.counselingService.logCounselingSession(sessionDto);
  }

  @Get('counseling/patient/:patientId')
  async getCounselingHistory(@Param('patientId') patientId: string) {
    return await this.counselingService.getCounselingHistory(patientId);
  }

  @Get('counseling/prescription/:prescriptionId')
  async getCounselingByPrescription(@Param('prescriptionId') prescriptionId: string) {
    return await this.counselingService.getCounselingByPrescription(prescriptionId);
  }

  @Get('counseling/prescription/:prescriptionId/required-topics')
  async getRequiredCounselingTopics(@Param('prescriptionId') prescriptionId: string) {
    return await this.counselingService.getRequiredCounselingTopics(prescriptionId);
  }

  @Get('counseling/prescription/:prescriptionId/validation')
  async validateCounselingCompletion(@Param('prescriptionId') prescriptionId: string) {
    return await this.counselingService.validateCounselingCompletion(prescriptionId);
  }

  @Get('counseling/statistics')
  async getCounselingStatistics(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return await this.counselingService.getCounselingStatistics(
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  // Medication Error Reporting Endpoints
  @Post('errors')
  async reportError(@Body() reportDto: ReportErrorDto) {
    return await this.errorService.reportError(reportDto);
  }

  @Get('errors')
  async getErrors(
    @Query('type') type?: string,
    @Query('severity') severity?: string,
    @Query('status') status?: string,
  ) {
    if (type) {
      return await this.errorService.getErrorsByType(type as any);
    }
    if (severity) {
      return await this.errorService.getErrorsBySeverity(severity as any);
    }
    if (status === 'open') {
      return await this.errorService.getOpenErrors();
    }
    return await this.errorService.getOpenErrors(); // Default to open errors
  }

  @Get('errors/:id')
  async getError(@Param('id') id: string) {
    return await this.errorService.findOne(id);
  }

  @Post('errors/:id/corrective-action')
  async addCorrectiveAction(@Param('id') id: string, @Body('action') action: string) {
    return await this.errorService.addCorrectiveAction(id, action);
  }

  @Post('errors/:id/preventive-action')
  async addPreventiveAction(@Param('id') id: string, @Body('action') action: string) {
    return await this.errorService.addPreventiveAction(id, action);
  }

  @Post('errors/:id/notify-patient')
  async notifyPatient(@Param('id') id: string) {
    return await this.errorService.notifyPatient(id);
  }

  @Post('errors/:id/notify-prescriber')
  async notifyPrescriber(@Param('id') id: string) {
    return await this.errorService.notifyPrescriber(id);
  }

  @Post('errors/:id/report-fda')
  async reportToFDA(@Param('id') id: string, @Body('fdaReportNumber') fdaReportNumber: string) {
    return await this.errorService.reportToFDA(id, fdaReportNumber);
  }

  @Post('errors/:id/close')
  async closeError(@Param('id') id: string, @Body('followUpActions') followUpActions?: string) {
    return await this.errorService.closeError(id, followUpActions);
  }

  @Get('errors/statistics/summary')
  async getErrorStatistics(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return await this.errorService.getErrorStatistics(
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  @Get('errors/statistics/trends')
  async getErrorTrends(@Query('months') months?: string) {
    return await this.errorService.getTrendAnalysis(months ? parseInt(months) : 12);
  }

  // Prescription Validation Endpoints
  @Post('validation/prescription/:prescriptionId')
  async validatePrescription(
    @Param('prescriptionId') prescriptionId: string,
    @Body() patientFactors: PatientFactors,
  ) {
    return await this.validationService.validatePrescription(prescriptionId, patientFactors);
  }
}
