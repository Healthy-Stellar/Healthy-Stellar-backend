import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { TreatmentPlanService } from '../services/treatment-plan.service';
import { MedicalProcedureService } from '../services/medical-procedure.service';
import { CarePlanTemplateService } from '../services/care-plan-template.service';
import { TreatmentOutcomeService } from '../services/treatment-outcome.service';
import { DecisionSupportService } from '../services/decision-support.service';
import {
  CreateTreatmentPlanDto,
  UpdateTreatmentPlanDto,
  SearchTreatmentPlansDto,
  CreateMedicalProcedureDto,
  UpdateMedicalProcedureDto,
  CreateCarePlanTemplateDto,
  UpdateCarePlanTemplateDto,
  ApplyTemplateDto,
  CreateTreatmentOutcomeDto,
} from '../dto/treatment-planning.dto';

@ApiTags('Treatment Plans')
@ApiBearerAuth()
@Controller('treatment-plans')
export class TreatmentPlanController {
  constructor(private readonly treatmentPlanService: TreatmentPlanService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new treatment plan' })
  @ApiResponse({ status: 201, description: 'Treatment plan created successfully' })
  async create(@Body() createDto: CreateTreatmentPlanDto) {
    return await this.treatmentPlanService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Search treatment plans with filters' })
  async search(@Query() searchDto: SearchTreatmentPlansDto) {
    return await this.treatmentPlanService.search(searchDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get treatment plan by ID' })
  @ApiParam({ name: 'id', description: 'Treatment plan UUID' })
  async findById(@Param('id') id: string) {
    return await this.treatmentPlanService.findById(id);
  }

  @Get('patient/:patientId')
  @ApiOperation({ summary: 'Get all treatment plans for a patient' })
  @ApiParam({ name: 'patientId', description: 'Patient UUID' })
  async findByPatientId(@Param('patientId') patientId: string) {
    return await this.treatmentPlanService.findByPatientId(patientId);
  }

  @Get('diagnosis/:diagnosisId')
  @ApiOperation({ summary: 'Get treatment plans associated with a diagnosis' })
  async findByDiagnosisId(@Param('diagnosisId') diagnosisId: string) {
    return await this.treatmentPlanService.findByDiagnosisId(diagnosisId);
  }

  @Get('patient/:patientId/active')
  @ApiOperation({ summary: 'Get active treatment plans for a patient' })
  @ApiParam({ name: 'patientId', description: 'Patient UUID' })
  async getActivePlans(@Param('patientId') patientId: string) {
    return await this.treatmentPlanService.getActivePlans(patientId);
  }

  @Get(':id/versions')
  @ApiOperation({ summary: 'Get version history for a treatment plan' })
  @ApiParam({ name: 'id', description: 'Treatment plan UUID' })
  async getVersionHistory(@Param('id') id: string) {
    return await this.treatmentPlanService.getVersionHistory(id);
  }

  @Get(':id/progress')
  @ApiOperation({ summary: 'Get care-plan progress and tracking metrics' })
  async getProgress(@Param('id') id: string) {
    return await this.treatmentPlanService.getProgress(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a treatment plan' })
  @ApiParam({ name: 'id', description: 'Treatment plan UUID' })
  async update(@Param('id') id: string, @Body() updateDto: UpdateTreatmentPlanDto) {
    return await this.treatmentPlanService.update(id, updateDto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update treatment plan status' })
  @ApiParam({ name: 'id', description: 'Treatment plan UUID' })
  async updateStatus(
    @Param('id') id: string,
    @Body() body: { status: string; updatedBy?: string },
  ) {
    return await this.treatmentPlanService.updateStatus(id, body.status as any, body.updatedBy);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a treatment plan' })
  @ApiParam({ name: 'id', description: 'Treatment plan UUID' })
  async delete(@Param('id') id: string) {
    await this.treatmentPlanService.delete(id);
  }
}

@ApiTags('Medical Procedures')
@ApiBearerAuth()
@Controller('procedures')
export class MedicalProcedureController {
  constructor(private readonly procedureService: MedicalProcedureService) {}

  @Post()
  @ApiOperation({ summary: 'Schedule a new medical procedure' })
  @ApiResponse({ status: 201, description: 'Procedure scheduled successfully' })
  async create(@Body() createDto: CreateMedicalProcedureDto) {
    return await this.procedureService.create(createDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get procedure by ID' })
  @ApiParam({ name: 'id', description: 'Procedure UUID' })
  async findById(@Param('id') id: string) {
    return await this.procedureService.findById(id);
  }

  @Get('patient/:patientId')
  @ApiOperation({ summary: 'Get all procedures for a patient' })
  @ApiParam({ name: 'patientId', description: 'Patient UUID' })
  async findByPatientId(@Param('patientId') patientId: string) {
    return await this.procedureService.findByPatientId(patientId);
  }

  @Get('schedule/:providerId')
  @ApiOperation({ summary: 'Get provider schedule' })
  @ApiParam({ name: 'providerId', description: 'Provider UUID' })
  async getSchedule(
    @Param('providerId') providerId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return await this.procedureService.getSchedule(
      providerId,
      new Date(startDate),
      new Date(endDate),
    );
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a procedure' })
  @ApiParam({ name: 'id', description: 'Procedure UUID' })
  async update(@Param('id') id: string, @Body() updateDto: UpdateMedicalProcedureDto) {
    return await this.procedureService.update(id, updateDto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update procedure status' })
  @ApiParam({ name: 'id', description: 'Procedure UUID' })
  async updateStatus(
    @Param('id') id: string,
    @Body() body: { status: string; updatedBy?: string },
  ) {
    return await this.procedureService.updateStatus(id, body.status as any, body.updatedBy);
  }

  @Post(':id/outcome')
  @ApiOperation({ summary: 'Record procedure outcome' })
  @ApiParam({ name: 'id', description: 'Procedure UUID' })
  async recordOutcome(@Param('id') id: string, @Body() body: { outcome: any; updatedBy?: string }) {
    return await this.procedureService.recordOutcome(id, body.outcome, body.updatedBy);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel a procedure' })
  async cancel(
    @Param('id') id: string,
    @Body() body: { reason?: string; updatedBy?: string },
  ) {
    return await this.procedureService.cancel(id, body.reason, body.updatedBy);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a procedure' })
  @ApiParam({ name: 'id', description: 'Procedure UUID' })
  async delete(@Param('id') id: string) {
    await this.procedureService.delete(id);
  }
}

@ApiTags('Care Plan Templates')
@ApiBearerAuth()
@Controller('care-templates')
export class CarePlanTemplateController {
  constructor(private readonly templateService: CarePlanTemplateService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new care plan template' })
  @ApiResponse({ status: 201, description: 'Template created successfully' })
  async create(@Body() createDto: CreateCarePlanTemplateDto) {
    return await this.templateService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all active templates' })
  async findAll() {
    return await this.templateService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get template by ID' })
  @ApiParam({ name: 'id', description: 'Template UUID' })
  async findById(@Param('id') id: string) {
    return await this.templateService.findById(id);
  }

  @Get('icd10/:code')
  @ApiOperation({ summary: 'Find templates by ICD-10 code' })
  @ApiParam({ name: 'code', description: 'ICD-10 code' })
  async findByIcd10Code(@Param('code') code: string) {
    return await this.templateService.findByIcd10Code(code);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a template' })
  @ApiParam({ name: 'id', description: 'Template UUID' })
  async update(@Param('id') id: string, @Body() updateDto: UpdateCarePlanTemplateDto) {
    return await this.templateService.update(id, updateDto);
  }

  @Post('apply')
  @ApiOperation({ summary: 'Apply template to create treatment plan' })
  async applyTemplate(@Body() applyDto: ApplyTemplateDto) {
    return await this.templateService.applyTemplate(applyDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a template' })
  @ApiParam({ name: 'id', description: 'Template UUID' })
  async delete(@Param('id') id: string) {
    await this.templateService.delete(id);
  }
}

@ApiTags('Treatment Outcomes')
@ApiBearerAuth()
@Controller('outcomes')
export class TreatmentOutcomeController {
  constructor(private readonly outcomeService: TreatmentOutcomeService) {}

  @Post()
  @ApiOperation({ summary: 'Record a treatment outcome' })
  @ApiResponse({ status: 201, description: 'Outcome recorded successfully' })
  async create(@Body() createDto: CreateTreatmentOutcomeDto) {
    return await this.outcomeService.create(createDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get outcome by ID' })
  @ApiParam({ name: 'id', description: 'Outcome UUID' })
  async findById(@Param('id') id: string) {
    return await this.outcomeService.findById(id);
  }

  @Get('plan/:treatmentPlanId')
  @ApiOperation({ summary: 'Get outcomes for a treatment plan' })
  @ApiParam({ name: 'treatmentPlanId', description: 'Treatment plan UUID' })
  async findByTreatmentPlanId(@Param('treatmentPlanId') treatmentPlanId: string) {
    return await this.outcomeService.findByTreatmentPlanId(treatmentPlanId);
  }

  @Get('patient/:patientId')
  @ApiOperation({ summary: 'Get outcomes for a patient' })
  @ApiParam({ name: 'patientId', description: 'Patient UUID' })
  async findByPatientId(@Param('patientId') patientId: string) {
    return await this.outcomeService.findByPatientId(patientId);
  }

  @Get('analytics')
  @ApiOperation({ summary: 'Get outcome analytics' })
  async getAnalytics(
    @Query('patientId') patientId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return await this.outcomeService.getAnalytics(
      patientId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an outcome' })
  @ApiParam({ name: 'id', description: 'Outcome UUID' })
  async delete(@Param('id') id: string) {
    await this.outcomeService.delete(id);
  }
}

@ApiTags('Decision Support')
@ApiBearerAuth()
@Controller('decision-support')
export class DecisionSupportController {
  constructor(private readonly decisionSupportService: DecisionSupportService) {}

  @Get('guidelines/:diagnosisCode')
  @ApiOperation({ summary: 'Get clinical guidelines for a diagnosis code' })
  @ApiParam({ name: 'diagnosisCode', description: 'ICD-10 diagnosis code' })
  async getGuidelines(@Param('diagnosisCode') diagnosisCode: string) {
    return await this.decisionSupportService.findGuidelinesByDiagnosisCode(diagnosisCode);
  }

  @Get('alerts/:patientId')
  @ApiOperation({ summary: 'Get decision support alerts for a patient' })
  @ApiParam({ name: 'patientId', description: 'Patient UUID' })
  async getPatientAlerts(
    @Param('patientId') patientId: string,
    @Query('includeAcknowledged') includeAcknowledged?: boolean,
  ) {
    return await this.decisionSupportService.getPatientAlerts(patientId, includeAcknowledged);
  }

  @Post('alerts/:alertId/acknowledge')
  @ApiOperation({ summary: 'Acknowledge an alert' })
  @ApiParam({ name: 'alertId', description: 'Alert UUID' })
  async acknowledgeAlert(
    @Param('alertId') alertId: string,
    @Body() body: { acknowledgedBy: string; notes?: string },
  ) {
    return await this.decisionSupportService.acknowledgeAlert(
      alertId,
      body.acknowledgedBy,
      body.notes,
    );
  }

  @Post('alerts/:alertId/dismiss')
  @ApiOperation({ summary: 'Dismiss an alert' })
  @ApiParam({ name: 'alertId', description: 'Alert UUID' })
  async dismissAlert(@Param('alertId') alertId: string, @Body() body: { reason?: string }) {
    return await this.decisionSupportService.dismissAlert(alertId, body.reason);
  }

  @Post('evaluate')
  @ApiOperation({ summary: 'Evaluate a treatment plan for recommendations' })
  async evaluateTreatmentPlan(@Body() body: { treatmentPlanId: string; diagnosisIds: string[] }) {
    return await this.decisionSupportService.evaluateTreatmentPlan(
      body.treatmentPlanId,
      body.diagnosisIds,
    );
  }
}
