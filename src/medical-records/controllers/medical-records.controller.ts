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
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { MedicalRecordsService } from '../services/medical-records.service';
import { CreateMedicalRecordDto } from '../dto/create-medical-record.dto';
import { UpdateMedicalRecordDto } from '../dto/update-medical-record.dto';
import { SearchMedicalRecordsDto } from '../dto/search-medical-records.dto';
import { AuditInterceptor } from '../../common/audit/audit.interceptor';

@ApiTags('Medical Records')
@ApiBearerAuth()
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
    @Req() req: any,
  ) {
    // Use a valid UUID format for system user, or get from auth
    const userId = req.user?.id || '00000000-0000-0000-0000-000000000000';
    const userName = req.user?.name || 'System';
    return this.medicalRecordsService.create(createDto, userId, userName);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search medical records' })
  @ApiResponse({ status: 200, description: 'Search results' })
  async search(@Query() searchDto: SearchMedicalRecordsDto) {
    return this.medicalRecordsService.search(searchDto);
  }

  @Get('timeline/:patientId')
  @ApiOperation({ summary: 'Get medical history timeline for a patient' })
  @ApiResponse({ status: 200, description: 'Timeline retrieved successfully' })
  async getTimeline(
    @Param('patientId') patientId: string,
    @Query('limit') limit?: number,
  ) {
    return this.medicalRecordsService.getTimeline(patientId, limit || 50);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a medical record by ID' })
  @ApiResponse({ status: 200, description: 'Medical record retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Medical record not found' })
  async findOne(
    @Param('id') id: string,
    @Query('patientId') patientId?: string,
    @Req() req?: any,
  ) {
    const record = await this.medicalRecordsService.findOne(id, patientId);
    
    // Record view for audit trail
    if (patientId) {
      const userId = req?.user?.userId || req?.user?.id || '00000000-0000-0000-0000-000000000000';
      const userName = req?.user?.email || 'System';
      await this.medicalRecordsService.recordView(
        id,
        patientId,
        userId,
        userName,
        req?.ip,
        req?.headers?.['user-agent'],
      );
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
    @Req() req: any,
    @Query('changeReason') changeReason?: string,
  ) {
    const userId = req.user?.id || '00000000-0000-0000-0000-000000000000';
    const userName = req.user?.name || 'System';
    return this.medicalRecordsService.update(id, updateDto, userId, userName, changeReason);
  }

  @Put(':id/archive')
  @ApiOperation({ summary: 'Archive a medical record' })
  @ApiResponse({ status: 200, description: 'Medical record archived successfully' })
  async archive(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.id || '00000000-0000-0000-0000-000000000000';
    const userName = req.user?.name || 'System';
    return this.medicalRecordsService.archive(id, userId, userName);
  }

  @Put(':id/restore')
  @ApiOperation({ summary: 'Restore an archived medical record' })
  @ApiResponse({ status: 200, description: 'Medical record restored successfully' })
  async restore(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.id || '00000000-0000-0000-0000-000000000000';
    const userName = req.user?.name || 'System';
    return this.medicalRecordsService.restore(id, userId, userName);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a medical record (soft delete)' })
  @ApiResponse({ status: 204, description: 'Medical record deleted successfully' })
  async delete(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.id || '00000000-0000-0000-0000-000000000000';
    const userName = req.user?.name || 'System';
    await this.medicalRecordsService.delete(id, userId, userName);
  }
}
