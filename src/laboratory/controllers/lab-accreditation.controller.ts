import { Controller, Get, Post, Body, Param, Patch, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { LabAccreditationService } from '../services/lab-accreditation.service';
import { CreateLabAccreditationDto } from '../dto/create-lab-accreditation.dto';
import { AccreditationStatus } from '../entities/lab-accreditation.entity';
import { ComplianceStatus, ComplianceType } from '../entities/lab-compliance-record.entity';

@ApiTags('Lab Accreditation & Compliance')
@Controller('lab-accreditation')
export class LabAccreditationController {
  constructor(private readonly accreditationService: LabAccreditationService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new accreditation record' })
  @ApiResponse({ status: 201, description: 'Accreditation created successfully' })
  create(@Body() createAccreditationDto: CreateLabAccreditationDto) {
    return this.accreditationService.create(createAccreditationDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all accreditations' })
  @ApiResponse({ status: 200, description: 'List of all accreditations' })
  findAll() {
    return this.accreditationService.findAll();
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Get compliance dashboard' })
  @ApiResponse({ status: 200, description: 'Compliance dashboard data' })
  getDashboard() {
    return this.accreditationService.getComplianceDashboard();
  }

  @Get('expiring')
  @ApiOperation({ summary: 'Get expiring accreditations' })
  @ApiResponse({ status: 200, description: 'List of expiring accreditations' })
  @ApiQuery({ name: 'daysAhead', type: Number, required: false })
  getExpiring(@Query('daysAhead') daysAhead?: number) {
    return this.accreditationService.getExpiringAccreditations(daysAhead);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get accreditation by ID' })
  @ApiResponse({ status: 200, description: 'Accreditation details' })
  findOne(@Param('id') id: string) {
    return this.accreditationService.findOne(id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update accreditation status' })
  @ApiResponse({ status: 200, description: 'Status updated successfully' })
  updateStatus(@Param('id') id: string, @Body('status') status: AccreditationStatus) {
    return this.accreditationService.updateStatus(id, status);
  }

  @Patch(':id/schedule-assessment')
  @ApiOperation({ summary: 'Schedule assessment' })
  @ApiResponse({ status: 200, description: 'Assessment scheduled successfully' })
  scheduleAssessment(@Param('id') id: string, @Body('assessmentDate') assessmentDate: string) {
    return this.accreditationService.scheduleAssessment(id, new Date(assessmentDate));
  }

  @Post(':id/compliance-records')
  @ApiOperation({ summary: 'Create compliance record' })
  @ApiResponse({ status: 201, description: 'Compliance record created successfully' })
  createComplianceRecord(@Param('id') accreditationId: string, @Body() recordData: any) {
    return this.accreditationService.createComplianceRecord(accreditationId, recordData);
  }

  @Get(':id/compliance-records')
  @ApiOperation({ summary: 'Get compliance records for accreditation' })
  @ApiResponse({ status: 200, description: 'List of compliance records' })
  getComplianceRecords(@Param('id') accreditationId: string) {
    return this.accreditationService.getComplianceRecords(accreditationId);
  }

  @Get('compliance/status/:status')
  @ApiOperation({ summary: 'Get compliance records by status' })
  @ApiResponse({ status: 200, description: 'List of compliance records with specified status' })
  getComplianceByStatus(@Param('status') status: ComplianceStatus) {
    return this.accreditationService.getComplianceByStatus(status);
  }

  @Get('compliance/type/:type')
  @ApiOperation({ summary: 'Get compliance records by type' })
  @ApiResponse({ status: 200, description: 'List of compliance records with specified type' })
  getComplianceByType(@Param('type') type: ComplianceType) {
    return this.accreditationService.getComplianceByType(type);
  }
}
