import { Controller, Post, Body, UseGuards, UseFilters, Inject } from '@nestjs/common';
import { CreateMedicalRecordValidatedDto } from '../dto/create-medical-record-validated.dto';
import { MedicalRecordsService } from '../services/medical-records.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { MedicalEmergencyErrorFilter } from '../../common/errors/medical-emergency-error.filter';
import { MedicalOperationAuditService } from '../../common/audit/medical-operation-audit.service';
import { MedicalDataValidationPipe } from '../../common/validation/medical-data.validator.pipe';

@Controller('medical-records')
@UseGuards(JwtAuthGuard)
@UseFilters(MedicalEmergencyErrorFilter)
export class MedicalRecordsValidatedController {
  constructor(
    private medicalRecordsService: MedicalRecordsService,
    @Inject(MedicalOperationAuditService)
    private auditService: MedicalOperationAuditService,
  ) {}

  @Post()
  async createMedicalRecord(
    @Body(MedicalDataValidationPipe)
    createMedicalRecordDto: CreateMedicalRecordValidatedDto,
  ) {
    const record = await this.medicalRecordsService.create(createMedicalRecordDto);

    await this.auditService.logMedicalRecordModification(
      'system',
      createMedicalRecordDto.patientId,
      { recordId: record.id },
    );

    return {
      success: true,
      data: record,
      timestamp: new Date().toISOString(),
    };
  }
}
