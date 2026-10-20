import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  Patch,
  UseGuards,
  HttpCode,
  HttpStatus,
  DefaultValuePipe,
  ParseIntPipe,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Icd10ValidationService } from './services/icd10-validation.service';
import { CptValidationService } from './services/cpt-validation.service';
import { LoincValidationService } from './services/loinc-validation.service';
import { ClinicalDataQualityService } from './services/clinical-data-quality.service';
import { ClinicalDecisionSupportService } from './services/clinical-decision-support.service';
import { ReferenceDataService } from './services/reference-data.service';
import { DataGovernanceService } from './services/data-governance.service';
import { MedicalMonitoringService } from '../medical-monitoring/medical-monitoring.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  ValidateIcd10Dto,
  ValidateCptDto,
  ValidateLoincDto,
  BulkCodeValidationDto,
  ClinicalDataQualityCheckDto,
  MedicalAlertDto,
  DataGovernancePolicyDto,
} from './dto/medical-validation.dto';

const CLINICAL_ROLES = ['admin', 'super_admin', 'physician', 'doctor', 'nurse', 'clinician'];
const GOVERNANCE_ROLES = ['admin', 'super_admin', 'compliance_officer'];

@ApiTags('Medical Data Validation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('medical-validation')
export class MedicalValidationController {
  constructor(
    private readonly icd10Service: Icd10ValidationService,
    private readonly cptService: CptValidationService,
    private readonly loincService: LoincValidationService,
    private readonly dataQualityService: ClinicalDataQualityService,
    private readonly cdsService: ClinicalDecisionSupportService,
    private readonly referenceDataService: ReferenceDataService,
    private readonly governanceService: DataGovernanceService,
    private readonly monitoringService: MedicalMonitoringService,
  ) {}

  // ─── Code Validation ──────────────────────────────────────────────────────

  @Post('codes/icd10/validate')
  @ApiOperation({ summary: 'Validate an ICD-10-CM diagnosis code' })
  @ApiResponse({ status: 200, description: 'Validation result' })
  async validateIcd10(@Body() dto: ValidateIcd10Dto) {
    return this.icd10Service.validate(dto.code, dto.codeYear);
  }

  @Post('codes/cpt/validate')
  @ApiOperation({ summary: 'Validate a CPT procedure code' })
  async validateCpt(@Body() dto: ValidateCptDto) {
    return this.cptService.validate(dto.code, dto.associatedDiagnosisCodes);
  }

  @Post('codes/loinc/validate')
  @ApiOperation({ summary: 'Validate a LOINC lab observation code' })
  async validateLoinc(@Body() dto: ValidateLoincDto) {
    return this.loincService.validate(dto.code, dto.observedValue, dto.unit);
  }

  @Post('codes/bulk-validate')
  @ApiOperation({ summary: 'Bulk validate codes across multiple systems' })
  @HttpCode(HttpStatus.OK)
  async bulkValidate(@Body() dto: BulkCodeValidationDto) {
    const startTime = Date.now();
    const results = {
      icd10: [] as any[],
      cpt: [] as any[],
      loinc: [] as any[],
    };

    await Promise.all([
      ...(dto.icd10Codes || []).map(async (c) => {
        const result = await this.icd10Service.validate(c.code, c.codeYear);
        results.icd10.push(result);
      }),
      ...(dto.cptCodes || []).map(async (c) => {
        const result = await this.cptService.validate(c.code, c.associatedDiagnosisCodes);
        results.cpt.push(result);
      }),
      ...(dto.loincCodes || []).map(async (c) => {
        const result = await this.loincService.validate(c.code, c.observedValue, c.unit);
        results.loinc.push(result);
      }),
    ]);

    const allResults = [...results.icd10, ...results.cpt, ...results.loinc];
    const processingTimeMs = Date.now() - startTime;

    return {
      totalCodes: allResults.length,
      validCount: allResults.filter((r) => r.isValid).length,
      invalidCount: allResults.filter((r) => !r.isValid).length,
      warningCount: allResults.filter((r) => r.warnings.length > 0).length,
      results: allResults,
      processingTimeMs,
    };
  }

  @Get('codes/search')
  @ApiOperation({ summary: 'Search medical codes across registries' })
  @ApiQuery({ name: 'q', description: 'Search query' })
  @ApiQuery({ name: 'system', required: false, description: 'Code system (ICD-10, CPT, LOINC)' })
  @ApiQuery({ name: 'activeOnly', required: false, type: Boolean })
  async searchCodes(
    @Query('q') query: string,
    @Query('system') system?: string,
    @Query('activeOnly') activeOnly: boolean = true,
  ) {
    return this.referenceDataService.searchCodes(query, system, activeOnly);
  }

  // ─── Data Quality ─────────────────────────────────────────────────────────

  @Post('data-quality/assess')
  @ApiOperation({ summary: 'Assess clinical data quality for a record' })
  async assessDataQuality(@Body() dto: ClinicalDataQualityCheckDto) {
    return this.dataQualityService.assessQuality(
      dto.recordId,
      dto.recordType,
      dto.data,
      dto.requiredFields,
    );
  }

  @Get('data-quality/trend/:recordType')
  @ApiOperation({ summary: 'Get data quality trend for a record type' })
  @ApiQuery({ name: 'days', required: false, type: Number })
  async getQualityTrend(@Param('recordType') recordType: string, @Query('days') days: number = 30) {
    return this.dataQualityService.getQualityTrend(recordType, days);
  }

  @Get('data-quality/completeness')
  @ApiOperation({ summary: 'Get data completeness report' })
  @ApiQuery({ name: 'recordType', required: false })
  async getCompletenessReport(@Query('recordType') recordType?: string) {
    return this.monitoringService.getDataCompletenessReport(recordType);
  }

  // ─── Clinical Decision Support ────────────────────────────────────────────

  @Post('clinical-alerts/drug-interactions')
  @ApiOperation({ summary: 'Check for drug-drug interactions' })
  async checkDrugInteractions(@Body() body: { patientId: string; medicationCodes: string[] }) {
    return this.cdsService.checkDrugInteractions(body);
  }

  @Post('clinical-alerts/critical-values')
  @ApiOperation({ summary: 'Check for critical lab values' })
  async checkCriticalValues(
    @Body() body: { patientId: string; loincCode: string; value: number; unit: string },
  ) {
    return this.cdsService.checkCriticalValues(body);
  }

  @Post('clinical-alerts/allergy-check')
  @ApiOperation({ summary: 'Check for allergy contraindications' })
  async checkAllergyContraindications(
    @Body() body: { patientId: string; prescribedNdc: string; allergyList: string[] },
  ) {
    return this.cdsService.checkAllergyContraindications(body);
  }

  @Get('clinical-alerts/:patientId')
  @Roles(...CLINICAL_ROLES)
  @ApiOperation({ summary: 'Get clinical alerts for a patient' })
  @ApiQuery({ name: 'includeResolved', required: false, type: Boolean })
  async getPatientAlerts(
    @Param('patientId') patientId: string,
    @Query('includeResolved') includeResolved: boolean = false,
    @Req() req: any,
  ) {
    this.assertPatientAccess(req, patientId);
    return this.cdsService.getPatientAlerts(patientId, includeResolved);
  }

  @Patch('clinical-alerts/:alertId/acknowledge')
  @Roles(...CLINICAL_ROLES)
  @ApiOperation({ summary: 'Acknowledge/resolve a clinical alert' })
  async acknowledgeAlert(
    @Param('alertId') alertId: string,
    @Body() body: { overrideReason?: string },
    @Req() req: any,
  ) {
    const resolvedBy = req?.user?.id ?? req?.user?.userId ?? req?.user?.sub;
    if (!resolvedBy) {
      throw new ForbiddenException('Authenticated user required to acknowledge alerts');
    }
    return this.cdsService.acknowledgeAlert(alertId, resolvedBy, body?.overrideReason);
  }

  // ─── Reference Data ───────────────────────────────────────────────────────

  @Get('reference-data/stats')
  @ApiOperation({ summary: 'Get code system statistics' })
  async getReferenceDataStats() {
    return this.referenceDataService.getCodeSystemStats();
  }

  @Get('reference-data/updates')
  @ApiOperation({ summary: 'Get reference data update history' })
  @ApiQuery({ name: 'system', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getUpdateHistory(
    @Query('system') system?: string,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit = 10,
  ) {
    return this.referenceDataService.getUpdateHistory(system, limit);
  }

  private assertPatientAccess(req: any, patientId: string): void {
    const user = req?.user;
    if (!user) {
      throw new ForbiddenException('Authenticated user required');
    }
    const role = user.role;
    if (role === 'admin' || role === 'super_admin') {
      return;
    }
    const userPatientId = user.patientId ?? user.patient_id;
    if (userPatientId && userPatientId === patientId) {
      return;
    }
    const assigned = user.assignedPatientIds ?? user.patientIds;
    if (Array.isArray(assigned) && assigned.includes(patientId)) {
      return;
    }
    throw new ForbiddenException('Not authorized to access this patient\'s clinical alerts');
  }
}
