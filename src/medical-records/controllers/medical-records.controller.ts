import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { MedicalRecordsService } from '../services/medical-records.service';
import { CreateMedicalRecordDto } from '../dto/create-medical-record.dto';
import { UpdateMedicalRecordDto } from '../dto/update-medical-record.dto';
import { SearchMedicalRecordsDto } from '../dto/search-medical-records.dto';
import { AuditInterceptor } from '../../common/audit/audit.interceptor';
import { CurrentTenant } from '@/tenant';
import { CurrentUser } from '../../common/decorators/audit-context.decorator';
import { TenantGuard } from '@/tenant';

@ApiTags('Medical Records')
@ApiBearerAuth()
@UseGuards(TenantGuard)
@UseInterceptors(AuditInterceptor)
@Controller('medical-records')
export class MedicalRecordsController {
  constructor(private readonly medicalRecordsService: MedicalRecordsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new medical record' })
  @ApiResponse({ status: 201, description: 'Medical record created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async create(
    @Body() createDto: CreateMedicalRecordDto,
    @CurrentTenant('tenantId') tenantId: string,
    @CurrentUser() user: any,
  ) {
    const userId = user?.id || '00000000-0000-0000-0000-000000000000';
    const userName = user?.email || 'System';
    return this.medicalRecordsService.create(createDto, userId, userName, tenantId);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search medical records' })
  @ApiResponse({ status: 200, description: 'Search results' })
  async search(
    @Query() searchDto: SearchMedicalRecordsDto,
    @CurrentTenant('tenantId') tenantId: string,
  ) {
    return this.medicalRecordsService.search(searchDto, tenantId);
  }

  @Get('timeline/:patientId')
  @ApiOperation({ summary: 'Get medical history timeline for a patient' })
  @ApiResponse({ status: 200, description: 'Timeline retrieved successfully' })
  async getTimeline(@Param('patientId') patientId: string, @Query('limit') limit?: number) {
    return this.medicalRecordsService.getTimeline(patientId, limit || 50);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a medical record by ID' })
  @ApiResponse({ status: 200, description: 'Medical record retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Medical record not found' })
  async findOne(
    @Param('id') id: string,
    @CurrentTenant('tenantId') tenantId: string,
    @CurrentUser() user: any,
    @Query('patientId') patientId?: string,
  ) {
    const record = await this.medicalRecordsService.findOne(id, patientId, tenantId);

    if (patientId) {
      const userId = user?.id || '00000000-0000-0000-0000-000000000000';
      await this.medicalRecordsService.recordView(id, patientId, userId, user?.email);
    }

    return record;
  }

  @Get(':id/versions')
  @ApiOperation({ summary: 'Get version history for a medical record' })
  @ApiResponse({ status: 200, description: 'Version history retrieved successfully' })
  async getVersions(@Param('id') id: string) {
    return this.medicalRecordsService.getVersions(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a medical record' })
  @ApiResponse({ status: 200, description: 'Medical record updated successfully' })
  @ApiResponse({ status: 404, description: 'Medical record not found' })
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateMedicalRecordDto,
    @CurrentUser() user: any,
    @Query('changeReason') changeReason?: string,
  ) {
    const userId = user?.id || '00000000-0000-0000-0000-000000000000';
    const userName = user?.email || 'System';
    return this.medicalRecordsService.update(id, updateDto, userId, userName, changeReason);
  }

  @Put(':id/archive')
  @ApiOperation({ summary: 'Archive a medical record' })
  @ApiResponse({ status: 200, description: 'Medical record archived successfully' })
  async archive(@Param('id') id: string, @CurrentUser() user: any) {
    const userId = user?.id || '00000000-0000-0000-0000-000000000000';
    return this.medicalRecordsService.archive(id, userId, user?.email);
  }

  @Put(':id/restore')
  @ApiOperation({ summary: 'Restore an archived medical record' })
  @ApiResponse({ status: 200, description: 'Medical record restored successfully' })
  async restore(@Param('id') id: string, @CurrentUser() user: any) {
    const userId = user?.id || '00000000-0000-0000-0000-000000000000';
    return this.medicalRecordsService.restore(id, userId, user?.email);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a medical record (soft delete)' })
  @ApiResponse({ status: 204, description: 'Medical record deleted successfully' })
  async delete(@Param('id') id: string, @CurrentUser() user: any) {
    const userId = user?.id || '00000000-0000-0000-0000-000000000000';
    await this.medicalRecordsService.delete(id, userId, user?.email);
  }
}
