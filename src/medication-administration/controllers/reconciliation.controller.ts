import { Controller, Get, Post, Body, Patch, Param, Query, UseGuards } from '@nestjs/common';
import { ReconciliationService } from '../services/reconciliation.service';
import { CreateReconciliationDto } from '../dto/create-reconciliation.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import {
  ReconciliationType,
  ReconciliationStatus,
} from '../entities/medication-reconciliation.entity';

@Controller('medication-reconciliation')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReconciliationController {
  constructor(private readonly reconciliationService: ReconciliationService) {}

  @Post()
  @Roles('nurse', 'physician')
  create(@Body() createReconciliationDto: CreateReconciliationDto) {
    return this.reconciliationService.create(createReconciliationDto);
  }

  @Get()
  @Roles('nurse', 'physician', 'admin')
  findAll() {
    return this.reconciliationService.findAll();
  }

  @Get('patient/:patientId')
  @Roles('nurse', 'physician')
  findByPatient(@Param('patientId') patientId: string) {
    return this.reconciliationService.findByPatient(patientId);
  }

  @Get('pending')
  @Roles('nurse', 'physician')
  findPending() {
    return this.reconciliationService.findPending();
  }

  @Get('type/:type')
  @Roles('nurse', 'physician', 'admin')
  findByType(@Param('type') type: ReconciliationType) {
    return this.reconciliationService.findByType(type);
  }

  @Get('stats')
  @Roles('physician', 'admin')
  getReconciliationStats(@Query('startDate') startDate: string, @Query('endDate') endDate: string) {
    return this.reconciliationService.getReconciliationStats(startDate, endDate);
  }

  @Get(':id')
  @Roles('nurse', 'physician')
  findOne(@Param('id') id: string) {
    return this.reconciliationService.findOne(id);
  }

  @Patch(':id/status')
  @Roles('nurse', 'physician')
  updateStatus(@Param('id') id: string, @Body() statusData: { status: ReconciliationStatus }) {
    return this.reconciliationService.updateStatus(id, statusData.status);
  }

  @Post(':id/home-medications')
  @Roles('nurse', 'physician')
  addHomeMedications(@Param('id') id: string, @Body() medicationData: { medications: any[] }) {
    return this.reconciliationService.addHomeMedications(id, medicationData.medications);
  }

  @Post(':id/current-medications')
  @Roles('nurse', 'physician')
  addCurrentMedications(@Param('id') id: string, @Body() medicationData: { medications: any[] }) {
    return this.reconciliationService.addCurrentMedications(id, medicationData.medications);
  }

  @Post(':id/perform-reconciliation')
  @Roles('physician')
  performReconciliation(
    @Param('id') id: string,
    @Body() pharmacistData: { pharmacistId: string; pharmacistName: string },
  ) {
    return this.reconciliationService.performReconciliation(
      id,
      pharmacistData.pharmacistId,
      pharmacistData.pharmacistName,
    );
  }

  @Post(':id/review-discrepancies')
  @Roles('physician')
  reviewDiscrepancies(
    @Param('id') id: string,
    @Body()
    reviewData: {
      reviewerId: string;
      actions: any[];
      notes?: string;
    },
  ) {
    return this.reconciliationService.reviewDiscrepancies(
      id,
      reviewData.reviewerId,
      reviewData.actions,
      reviewData.notes,
    );
  }

  @Post(':id/check-allergies')
  @Roles('nurse', 'physician')
  checkAllergies(@Param('id') id: string) {
    return this.reconciliationService.checkAllergies(id);
  }

  @Post(':id/check-drug-interactions')
  @Roles('physician')
  checkDrugInteractions(
    @Param('id') id: string,
    @Body() interactionData: { interactions?: any[] },
  ) {
    return this.reconciliationService.checkDrugInteractions(id, interactionData.interactions);
  }

  @Post(':id/check-duplicate-therapy')
  @Roles('physician')
  checkDuplicateTherapy(@Param('id') id: string) {
    return this.reconciliationService.checkDuplicateTherapy(id);
  }

  @Post(':id/check-renal-dosing')
  @Roles('physician')
  checkRenalDosing(@Param('id') id: string) {
    return this.reconciliationService.checkRenalDosing(id);
  }

  @Post(':id/check-hepatic-dosing')
  @Roles('physician')
  checkHepaticDosing(@Param('id') id: string) {
    return this.reconciliationService.checkHepaticDosing(id);
  }

  @Post(':id/complete-patient-interview')
  @Roles('nurse', 'physician')
  completePatientInterview(@Param('id') id: string) {
    return this.reconciliationService.completePatientInterview(id);
  }

  @Post(':id/provide-medication-list')
  @Roles('nurse', 'physician')
  provideMedicationList(@Param('id') id: string) {
    return this.reconciliationService.provideMedicationList(id);
  }

  @Post(':id/complete-patient-education')
  @Roles('nurse', 'physician')
  completePatientEducation(@Param('id') id: string) {
    return this.reconciliationService.completePatientEducation(id);
  }
}
