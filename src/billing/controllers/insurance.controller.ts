import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { InsuranceService } from '../services/insurance.service';
import {
  CreateInsuranceDto,
  UpdateInsuranceDto,
  VerifyInsuranceDto,
  RequestAuthorizationDto,
} from '../dto/insurance.dto';

@ApiTags('insurance')
@Controller('insurance')
export class InsuranceController {
  constructor(private readonly insuranceService: InsuranceService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new insurance record' })
  @ApiResponse({ status: 201, description: 'Insurance record created successfully' })
  async create(@Body() createDto: CreateInsuranceDto) {
    return this.insuranceService.create(createDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get insurance by ID' })
  @ApiParam({ name: 'id', description: 'Insurance ID' })
  @ApiResponse({ status: 200, description: 'Insurance retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Insurance not found' })
  async findById(@Param('id') id: string) {
    return this.insuranceService.findById(id);
  }

  @Get('patient/:patientId')
  @ApiOperation({ summary: 'Get all insurance records for a patient' })
  @ApiParam({ name: 'patientId', description: 'Patient ID' })
  @ApiResponse({ status: 200, description: 'Insurance records retrieved successfully' })
  async findByPatientId(@Param('patientId') patientId: string) {
    return this.insuranceService.findByPatientId(patientId);
  }

  @Get('patient/:patientId/active')
  @ApiOperation({ summary: 'Get active insurance for a patient as of a specific date' })
  @ApiParam({ name: 'patientId', description: 'Patient ID' })
  @ApiQuery({ name: 'asOfDate', required: false, description: 'Date to check (defaults to today)' })
  async findActiveByPatientId(
    @Param('patientId') patientId: string,
    @Query('asOfDate') asOfDate?: string,
  ) {
    const date = asOfDate ? new Date(asOfDate) : undefined;
    return this.insuranceService.findActiveByPatientId(patientId, date);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update insurance record' })
  @ApiParam({ name: 'id', description: 'Insurance ID' })
  @ApiResponse({ status: 200, description: 'Insurance updated successfully' })
  @ApiResponse({ status: 404, description: 'Insurance not found' })
  async update(@Param('id') id: string, @Body() updateDto: UpdateInsuranceDto) {
    return this.insuranceService.update(id, updateDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete insurance record' })
  @ApiParam({ name: 'id', description: 'Insurance ID' })
  @ApiResponse({ status: 204, description: 'Insurance deleted successfully' })
  @ApiResponse({ status: 404, description: 'Insurance not found' })
  async delete(@Param('id') id: string) {
    return this.insuranceService.delete(id);
  }

  @Put(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate insurance record' })
  @ApiParam({ name: 'id', description: 'Insurance ID' })
  @ApiResponse({ status: 200, description: 'Insurance deactivated successfully' })
  async deactivate(@Param('id') id: string) {
    return this.insuranceService.deactivate(id);
  }

  @Post('verify')
  @ApiOperation({ summary: 'Verify insurance eligibility (270/271 transaction)' })
  @ApiResponse({ status: 200, description: 'Eligibility verification completed' })
  async verifyEligibility(@Body() verifyDto: VerifyInsuranceDto) {
    return this.insuranceService.verifyEligibility(verifyDto);
  }

  @Post('authorize')
  @ApiOperation({ summary: 'Request prior authorization (278 transaction)' })
  @ApiResponse({ status: 200, description: 'Authorization request processed' })
  async requestAuthorization(@Body() authDto: RequestAuthorizationDto) {
    return this.insuranceService.requestAuthorization(authDto);
  }

  @Get(':id/verifications')
  @ApiOperation({ summary: 'Get verification history for an insurance' })
  @ApiParam({ name: 'id', description: 'Insurance ID' })
  @ApiResponse({ status: 200, description: 'Verification history retrieved' })
  async getVerificationHistory(@Param('id') id: string) {
    return this.insuranceService.getVerificationHistory(id);
  }

  @Get(':id/verifications/latest')
  @ApiOperation({ summary: 'Get latest verification for an insurance' })
  @ApiParam({ name: 'id', description: 'Insurance ID' })
  @ApiResponse({ status: 200, description: 'Latest verification retrieved' })
  async getLatestVerification(@Param('id') id: string) {
    return this.insuranceService.getLatestVerification(id);
  }
}
