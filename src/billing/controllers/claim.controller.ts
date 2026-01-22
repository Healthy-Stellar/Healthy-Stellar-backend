import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { ClaimService } from '../services/claim.service';
import {
  CreateClaimDto,
  UpdateClaimDto,
  SubmitClaimDto,
  ClaimSearchDto,
  ProcessERADto,
} from '../dto/claim.dto';
import { ClaimStatus } from '../../common/enums';

@ApiTags('claims')
@Controller('claims')
export class ClaimController {
  constructor(private readonly claimService: ClaimService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new insurance claim' })
  @ApiResponse({ status: 201, description: 'Claim created successfully' })
  async create(@Body() createDto: CreateClaimDto) {
    return this.claimService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Search claims' })
  @ApiResponse({ status: 200, description: 'Claims retrieved successfully' })
  async search(@Query() searchDto: ClaimSearchDto) {
    return this.claimService.search(searchDto);
  }

  @Get('pending')
  @ApiOperation({ summary: 'Get all pending claims' })
  @ApiResponse({ status: 200, description: 'Pending claims retrieved' })
  async getPendingClaims() {
    return this.claimService.getPendingClaims();
  }

  @Get('status/:status')
  @ApiOperation({ summary: 'Get claims by status' })
  @ApiParam({ name: 'status', description: 'Claim status' })
  @ApiResponse({ status: 200, description: 'Claims retrieved successfully' })
  async getClaimsByStatus(@Param('status') status: ClaimStatus) {
    return this.claimService.getClaimsByStatus(status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get claim by ID' })
  @ApiParam({ name: 'id', description: 'Claim ID' })
  @ApiResponse({ status: 200, description: 'Claim retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Claim not found' })
  async findById(@Param('id') id: string) {
    return this.claimService.findById(id);
  }

  @Get('number/:claimNumber')
  @ApiOperation({ summary: 'Get claim by claim number' })
  @ApiParam({ name: 'claimNumber', description: 'Claim number' })
  @ApiResponse({ status: 200, description: 'Claim retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Claim not found' })
  async findByClaimNumber(@Param('claimNumber') claimNumber: string) {
    return this.claimService.findByClaimNumber(claimNumber);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update claim' })
  @ApiParam({ name: 'id', description: 'Claim ID' })
  @ApiResponse({ status: 200, description: 'Claim updated successfully' })
  @ApiResponse({ status: 404, description: 'Claim not found' })
  async update(@Param('id') id: string, @Body() updateDto: UpdateClaimDto) {
    return this.claimService.update(id, updateDto);
  }

  @Post('submit')
  @ApiOperation({ summary: 'Submit claim to payer (generates EDI 837)' })
  @ApiResponse({ status: 200, description: 'Claim submitted successfully' })
  async submit(@Body() submitDto: SubmitClaimDto) {
    return this.claimService.submit(submitDto);
  }

  @Post('process-era')
  @ApiOperation({ summary: 'Process ERA/remittance (EDI 835)' })
  @ApiResponse({ status: 200, description: 'ERA processed successfully' })
  async processERA(@Body() processDto: ProcessERADto) {
    return this.claimService.processERA(processDto);
  }

  @Put(':id/void')
  @ApiOperation({ summary: 'Void a claim' })
  @ApiParam({ name: 'id', description: 'Claim ID' })
  @ApiResponse({ status: 200, description: 'Claim voided successfully' })
  async voidClaim(@Param('id') id: string, @Body('reason') reason: string) {
    return this.claimService.voidClaim(id, reason);
  }
}
