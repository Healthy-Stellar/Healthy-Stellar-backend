import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ConsentService } from '../services/consent.service';
import { MedicalRecordsService } from '../services/medical-records.service';
import { CreateConsentDto } from '../dto/create-consent.dto';
import { ConsentType } from '../entities/medical-record-consent.entity';

@ApiTags('Consent Management')
@Controller('consents')
export class ConsentController {
  constructor(
    private readonly consentService: ConsentService,
    private readonly medicalRecordsService: MedicalRecordsService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new consent' })
  @ApiResponse({ status: 201, description: 'Consent created successfully' })
  async create(@Body() createDto: CreateConsentDto, @Req() req: any) {
    // Get patientId from the medical record
    const record = await this.medicalRecordsService.findOne(createDto.medicalRecordId);
    const patientId = record.patientId;
    const grantedBy = req.user?.id || '00000000-0000-0000-0000-000000000000';
    return this.consentService.create(createDto, patientId, grantedBy);
  }

  @Get('record/:recordId')
  @ApiOperation({ summary: 'Get all consents for a medical record' })
  @ApiResponse({ status: 200, description: 'Consents retrieved successfully' })
  async findByRecord(@Param('recordId') recordId: string) {
    return this.consentService.findByRecord(recordId);
  }

  @Get('patient/:patientId')
  @ApiOperation({ summary: 'Get all consents for a patient' })
  @ApiResponse({ status: 200, description: 'Consents retrieved successfully' })
  async findByPatient(@Param('patientId') patientId: string) {
    return this.consentService.findByPatient(patientId);
  }

  @Get('check')
  @ApiOperation({ summary: 'Check if consent exists for a record' })
  @ApiResponse({ status: 200, description: 'Consent check result' })
  async checkConsent(
    @Query('recordId') recordId: string,
    @Query('userId') userId: string,
    @Query('consentType') consentType: ConsentType,
  ) {
    const hasConsent = await this.consentService.checkConsent(
      recordId,
      userId,
      consentType,
    );
    return { hasConsent };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a consent by ID' })
  @ApiResponse({ status: 200, description: 'Consent retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Consent not found' })
  async findOne(@Param('id') id: string) {
    return this.consentService.findOne(id);
  }

  @Put(':id/revoke')
  @ApiOperation({ summary: 'Revoke a consent' })
  @ApiResponse({ status: 200, description: 'Consent revoked successfully' })
  async revoke(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @Req() req: any,
  ) {
    const revokedBy = req.user?.id || '00000000-0000-0000-0000-000000000000';
    return this.consentService.revoke(id, revokedBy, reason);
  }
}
